"""Article deduplication and clustering service.

Uses embedding-based cosine similarity (primary) with SequenceMatcher fallback.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.database import Article, Cluster, ClusterMember
from apps.api.redis_client import cache_get, cache_set, get_redis
from apps.api.services.embeddings import (
    generate_embeddings,
    cosine_similarity,
    compute_centroid,
)
from packages.shared.constants import (
    DEDUP_SIMILARITY_THRESHOLD,
    DEDUP_TIME_WINDOW_HOURS,
    EMBEDDING_SIMILARITY_THRESHOLD,
)
from packages.shared.schemas import normalize_title

logger = logging.getLogger(__name__)


def title_similarity(a: str, b: str) -> float:
    """Compute similarity between two normalized titles (fallback method)."""
    na = normalize_title(a)
    nb = normalize_title(b)
    return SequenceMatcher(None, na, nb).ratio()


async def _get_cluster_centroid(
    db: AsyncSession, cluster_id: int
) -> list[float] | None:
    """Get or compute the centroid embedding for a cluster.

    Checks Redis cache first, then computes from member articles.
    """
    cache_key = f"centroid:{cluster_id}"
    cached = await cache_get(cache_key)
    if cached and isinstance(cached, list):
        return cached

    # Compute from member articles that have embeddings
    result = await db.execute(
        select(Article.embedding)
        .where(Article.cluster_id == cluster_id)
        .where(Article.embedding.isnot(None))
        .limit(20)
    )
    embeddings = [row[0] for row in result.all() if row[0]]
    if not embeddings:
        return None

    centroid = compute_centroid(embeddings)
    # Cache for 5 minutes
    await cache_set(cache_key, centroid, ttl=300)
    return centroid


async def deduplicate_and_store(
    db: AsyncSession,
    articles: list,
) -> list[Article]:
    """Store articles, dedup by hash, and return stored records."""
    stored = []

    for art in articles:
        # Check for existing by hash
        existing = await db.execute(
            select(Article).where(Article.hash == art.hash).limit(1)
        )
        if existing.scalar_one_or_none():
            continue

        record = Article(
            provider=art.provider,
            source=art.source,
            title=art.title,
            url=art.url,
            published_at=art.published_at or datetime.now(timezone.utc),
            country=art.country,
            language=art.language,
            category=art.category,
            raw_snippet=art.raw_snippet,
            image_url=art.image_url,
            hash=art.hash,
            metadata_json={},
        )
        db.add(record)
        stored.append(record)

    if stored:
        await db.commit()
        for r in stored:
            await db.refresh(r)

    logger.info(f"Stored {len(stored)} new articles (deduped from {len(articles)})")
    return stored


async def _generate_missing_embeddings(db: AsyncSession) -> int:
    """Generate embeddings for articles that don't have them yet."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=DEDUP_TIME_WINDOW_HOURS)

    result = await db.execute(
        select(Article)
        .where(Article.embedding.is_(None))
        .where(Article.published_at >= cutoff)
        .order_by(Article.published_at.desc())
        .limit(200)
    )
    articles = list(result.scalars().all())

    if not articles:
        return 0

    texts = [
        f"{a.title} {(a.raw_snippet or '')[:200]}" for a in articles
    ]

    try:
        embeddings = await generate_embeddings(texts)
        if len(embeddings) == len(articles):
            for art, emb in zip(articles, embeddings):
                art.embedding = emb
            await db.commit()
            logger.info(f"Generated embeddings for {len(articles)} articles")
            return len(articles)
        else:
            logger.warning(
                f"Embedding count mismatch: {len(embeddings)} vs {len(articles)}"
            )
            return 0
    except Exception as e:
        logger.warning(f"Embedding generation failed, will use title fallback: {e}")
        return 0


async def cluster_articles(db: AsyncSession) -> int:
    """Assign unclustered articles to clusters.

    Primary: embedding cosine similarity (threshold 0.82)
    Fallback: SequenceMatcher title similarity (threshold 0.75)
    """
    # Step 1: Generate embeddings for articles that don't have them
    await _generate_missing_embeddings(db)

    cutoff = datetime.now(timezone.utc) - timedelta(hours=DEDUP_TIME_WINDOW_HOURS)

    # Get unclustered articles from the last window
    result = await db.execute(
        select(Article)
        .where(Article.cluster_id.is_(None))
        .where(Article.published_at >= cutoff)
        .order_by(Article.published_at.desc())
        .limit(200)
    )
    unclustered = list(result.scalars().all())

    if not unclustered:
        return 0

    # Get recent clusters for matching
    cluster_result = await db.execute(
        select(Cluster)
        .where(Cluster.last_updated >= cutoff)
        .order_by(Cluster.last_updated.desc())
        .limit(100)
    )
    existing_clusters = list(cluster_result.scalars().all())

    # Pre-compute cluster centroids for embedding comparison
    cluster_centroids: dict[int, list[float] | None] = {}
    for cluster in existing_clusters:
        cluster_centroids[cluster.cluster_id] = await _get_cluster_centroid(
            db, cluster.cluster_id
        )

    clusters_created = 0
    embedding_matches = 0
    title_matches = 0

    for article in unclustered:
        matched_cluster = None
        has_embedding = article.embedding is not None

        # Try embedding-based matching first (same category only)
        if has_embedding:
            best_sim = 0.0
            for cluster in existing_clusters:
                if cluster.top_category != article.category:
                    continue
                centroid = cluster_centroids.get(cluster.cluster_id)
                if centroid:
                    sim = cosine_similarity(article.embedding, centroid)
                    if sim >= EMBEDDING_SIMILARITY_THRESHOLD and sim > best_sim:
                        best_sim = sim
                        matched_cluster = cluster

            if matched_cluster:
                embedding_matches += 1

        # Fallback: title similarity (for articles without embeddings, or if embedding didn't match)
        if not matched_cluster:
            for cluster in existing_clusters:
                if cluster.top_category != article.category:
                    continue
                sim = title_similarity(article.title, cluster.canonical_title)
                if sim >= DEDUP_SIMILARITY_THRESHOLD:
                    matched_cluster = cluster
                    title_matches += 1
                    break

        if matched_cluster:
            article.cluster_id = matched_cluster.cluster_id
            member = ClusterMember(
                cluster_id=matched_cluster.cluster_id,
                article_id=article.id,
                source=article.source,
            )
            db.add(member)
            matched_cluster.last_updated = datetime.now(timezone.utc)
            # Invalidate centroid cache so it's recomputed with new member
            if has_embedding:
                try:
                    r = await get_redis()
                    await r.delete(f"cache:centroid:{matched_cluster.cluster_id}")
                except Exception:
                    pass
        else:
            # Check against other unclustered articles in this batch
            found_peer = False
            for other in unclustered:
                if other.id == article.id or other.cluster_id is None:
                    continue

                matched = False
                if has_embedding and other.embedding:
                    sim = cosine_similarity(article.embedding, other.embedding)
                    matched = sim >= EMBEDDING_SIMILARITY_THRESHOLD
                else:
                    sim = title_similarity(article.title, other.title)
                    matched = sim >= DEDUP_SIMILARITY_THRESHOLD

                if matched and other.cluster_id:
                    article.cluster_id = other.cluster_id
                    member = ClusterMember(
                        cluster_id=other.cluster_id,
                        article_id=article.id,
                        source=article.source,
                    )
                    db.add(member)
                    found_peer = True
                    break

            if not found_peer:
                # Create new cluster
                new_cluster = Cluster(
                    canonical_title=article.title,
                    canonical_url=article.url,
                    top_country=article.country,
                    top_category=article.category,
                    score=0.0,
                )
                db.add(new_cluster)
                await db.flush()

                article.cluster_id = new_cluster.cluster_id
                member = ClusterMember(
                    cluster_id=new_cluster.cluster_id,
                    article_id=article.id,
                    source=article.source,
                )
                db.add(member)
                existing_clusters.append(new_cluster)
                # Cache centroid for new single-article cluster
                if has_embedding:
                    cluster_centroids[new_cluster.cluster_id] = article.embedding
                clusters_created += 1

    await db.commit()
    logger.info(
        f"Clustering done: {clusters_created} new clusters, "
        f"{len(unclustered)} articles processed "
        f"(embedding: {embedding_matches}, title: {title_matches})"
    )
    return clusters_created
