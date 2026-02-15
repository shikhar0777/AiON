"""Story intelligence service — deep info about individual articles/clusters."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.database import Article, Cluster
from apps.api.redis_client import cache_get, cache_set
from packages.shared.constants import CACHE_TTL_STORY, CACHE_TTL_CLUSTER
from packages.shared.schemas import ArticleRead, ClusterRead, StoryIntelligence

logger = logging.getLogger(__name__)


async def get_story(db: AsyncSession, article_id: int) -> StoryIntelligence | None:
    """Get full story intelligence for an article."""
    cache_key = f"story:{article_id}"
    cached = await cache_get(cache_key)
    if cached:
        return StoryIntelligence(**cached)

    # Fetch article
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        return None

    article_read = ArticleRead(
        id=article.id,
        provider=article.provider,
        source=article.source,
        title=article.title,
        url=article.url,
        published_at=article.published_at,
        country=article.country,
        language=article.language,
        category=article.category,
        raw_snippet=article.raw_snippet,
        image_url=article.image_url,
        cluster_id=article.cluster_id,
        hash=article.hash,
        fetched_at=article.fetched_at,
        metadata_json=article.metadata_json,
    )

    cluster_read = None
    related = []
    source_angles = []

    if article.cluster_id:
        # Fetch cluster
        cl_result = await db.execute(
            select(Cluster).where(Cluster.cluster_id == article.cluster_id)
        )
        cluster = cl_result.scalar_one_or_none()
        if cluster:
            # Count articles in cluster
            from sqlalchemy import func
            count_result = await db.execute(
                select(func.count(Article.id)).where(
                    Article.cluster_id == cluster.cluster_id
                )
            )
            article_count = count_result.scalar() or 0

            # Get unique sources
            sources_result = await db.execute(
                select(Article.source)
                .where(Article.cluster_id == cluster.cluster_id)
                .distinct()
            )
            sources = [r[0] for r in sources_result.all()]

            cluster_read = ClusterRead(
                cluster_id=cluster.cluster_id,
                canonical_title=cluster.canonical_title,
                canonical_url=cluster.canonical_url,
                top_country=cluster.top_country,
                top_category=cluster.top_category,
                tags_json=cluster.tags_json or [],
                ai_summary=cluster.ai_summary,
                ai_key_points_json=cluster.ai_key_points_json or [],
                ai_entities_json=cluster.ai_entities_json or {},
                why_trending=cluster.why_trending,
                score=cluster.score,
                last_updated=cluster.last_updated,
                article_count=article_count,
                sources=sources,
                top_image_url=article.image_url,
            )

            # Get related articles
            rel_result = await db.execute(
                select(Article)
                .where(Article.cluster_id == article.cluster_id)
                .where(Article.id != article.id)
                .order_by(desc(Article.published_at))
                .limit(10)
            )
            for rel in rel_result.scalars().all():
                related.append(
                    ArticleRead(
                        id=rel.id,
                        provider=rel.provider,
                        source=rel.source,
                        title=rel.title,
                        url=rel.url,
                        published_at=rel.published_at,
                        country=rel.country,
                        language=rel.language,
                        category=rel.category,
                        raw_snippet=rel.raw_snippet,
                        image_url=rel.image_url,
                        cluster_id=rel.cluster_id,
                        hash=rel.hash,
                        fetched_at=rel.fetched_at,
                    )
                )

            # Build source angles
            for rel in related[:5]:
                source_angles.append({
                    "source": rel.source,
                    "headline": rel.title,
                    "angle": rel.raw_snippet[:120] if rel.raw_snippet else "",
                })

    intelligence = StoryIntelligence(
        article=article_read,
        cluster=cluster_read,
        ai_summary=cluster_read.ai_summary if cluster_read else None,
        key_points=cluster_read.ai_key_points_json if cluster_read else [],
        entities=cluster_read.ai_entities_json if cluster_read else None,
        why_trending=cluster_read.why_trending if cluster_read else None,
        related_articles=related,
        source_angles=source_angles,
        timeline=[],
    )

    await cache_set(cache_key, intelligence.model_dump(), ttl=CACHE_TTL_STORY)
    return intelligence


async def get_cluster_detail(db: AsyncSession, cluster_id: int) -> ClusterRead | None:
    """Get cluster detail."""
    cache_key = f"cluster:{cluster_id}"
    cached = await cache_get(cache_key)
    if cached:
        return ClusterRead(**cached)

    result = await db.execute(
        select(Cluster).where(Cluster.cluster_id == cluster_id)
    )
    cluster = result.scalar_one_or_none()
    if not cluster:
        return None

    from sqlalchemy import func
    count_result = await db.execute(
        select(func.count(Article.id)).where(Article.cluster_id == cluster_id)
    )
    article_count = count_result.scalar() or 0

    sources_result = await db.execute(
        select(Article.source).where(Article.cluster_id == cluster_id).distinct()
    )
    sources = [r[0] for r in sources_result.all()]

    img_result = await db.execute(
        select(Article.image_url)
        .where(Article.cluster_id == cluster_id)
        .where(Article.image_url.isnot(None))
        .limit(1)
    )
    top_image = img_result.scalar_one_or_none()

    read = ClusterRead(
        cluster_id=cluster.cluster_id,
        canonical_title=cluster.canonical_title,
        canonical_url=cluster.canonical_url,
        top_country=cluster.top_country,
        top_category=cluster.top_category,
        tags_json=cluster.tags_json or [],
        ai_summary=cluster.ai_summary,
        ai_key_points_json=cluster.ai_key_points_json or [],
        ai_entities_json=cluster.ai_entities_json or {},
        why_trending=cluster.why_trending,
        score=cluster.score,
        last_updated=cluster.last_updated,
        article_count=article_count,
        sources=sources,
        top_image_url=top_image,
    )

    await cache_set(cache_key, read.model_dump(), ttl=CACHE_TTL_CLUSTER)
    return read
