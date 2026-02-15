"""Search service — multi-signal ranked search with fast suggestions.

Ranking algorithm combines:
  1. Text relevance (exact > prefix > word-boundary > substring)
  2. Recency decay (newer articles score higher)
  3. Cluster score (trending/popular stories boost)
  4. Source diversity (dedup by source in final results)
"""

from __future__ import annotations

import logging
import math
import re
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, func, or_, desc, case, literal
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.database import Article, Cluster
from apps.api.redis_client import cache_get, cache_set

logger = logging.getLogger("aion.search")

# ── Cache TTLs ───────────────────────────────────────────────────
SUGGEST_CACHE_TTL = 120   # 2 minutes
SEARCH_CACHE_TTL = 180    # 3 minutes
MAX_SUGGESTIONS = 8
MAX_SEARCH_RESULTS = 30

# ── Text relevance scoring ───────────────────────────────────────

def _text_relevance(title: str, query: str) -> float:
    """Score how well a title matches the query (0-1 scale).

    Scoring tiers:
      1.0 — exact match (title == query)
      0.9 — title starts with query
      0.8 — all query words found at word boundaries
      0.6 — all query words found as substrings
      0.4 — some query words match at word boundaries
      0.2 — partial substring match
      0.0 — no match
    """
    t = title.lower().strip()
    q = query.lower().strip()

    if not q:
        return 0.0

    # Exact match
    if t == q:
        return 1.0

    # Starts with query
    if t.startswith(q):
        return 0.9

    # Word-level matching
    query_words = q.split()
    if not query_words:
        return 0.0

    # Check word-boundary matches (word starts with query word)
    title_words = re.findall(r'\w+', t)
    title_words_lower = [w.lower() for w in title_words]

    boundary_matches = 0
    substring_matches = 0
    for qw in query_words:
        # Word boundary: any title word starts with query word
        if any(tw.startswith(qw) for tw in title_words_lower):
            boundary_matches += 1
        elif qw in t:
            substring_matches += 1

    total_words = len(query_words)

    if boundary_matches == total_words:
        return 0.8

    if boundary_matches + substring_matches == total_words:
        return 0.6

    if boundary_matches > 0:
        return 0.2 + 0.2 * (boundary_matches / total_words)

    if substring_matches > 0:
        return 0.1 + 0.1 * (substring_matches / total_words)

    return 0.0


def _recency_score(published_at: datetime | None, now: datetime) -> float:
    """Score recency on 0-1 scale. Articles <1h old get 1.0, decays over 7 days."""
    if not published_at:
        return 0.1
    age_hours = max(0, (now - published_at.replace(tzinfo=timezone.utc if published_at.tzinfo is None else published_at.tzinfo)).total_seconds()) / 3600
    # Exponential decay: half-life of 24 hours
    return max(0.05, math.exp(-0.029 * age_hours))


def _cluster_boost(score: float) -> float:
    """Normalize cluster score to 0-1 boost. Higher cluster score = more sources = more important."""
    if score <= 0:
        return 0.0
    # Log scale: score of 10 => ~0.7, score of 50 => ~1.0
    return min(1.0, math.log1p(score) / math.log1p(50))


def _combined_rank(text_rel: float, recency: float, cluster_boost: float) -> float:
    """Combine signals into final rank. Text relevance is dominant signal."""
    return (text_rel * 0.55) + (recency * 0.25) + (cluster_boost * 0.20)


# ── Suggestions ──────────────────────────────────────────────────

async def get_suggestions(db: AsyncSession, query: str) -> dict[str, Any]:
    """Return fast autocomplete suggestions for the search bar.

    Returns article titles, cluster titles, matching categories, and sources.
    """
    q = query.strip()
    if len(q) < 2:
        return {"query": q, "suggestions": []}

    cache_key = f"search:suggest:{q.lower()}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    pattern = f"%{q}%"
    now = datetime.now(timezone.utc)

    # Search articles by title (ILIKE for case-insensitive)
    art_q = (
        select(Article.id, Article.title, Article.source, Article.category,
               Article.published_at, Article.image_url, Article.cluster_id)
        .where(Article.title.ilike(pattern))
        .order_by(desc(Article.published_at))
        .limit(50)
    )
    art_result = await db.execute(art_q)
    articles = art_result.all()

    # Search clusters by canonical title
    cl_q = (
        select(Cluster.cluster_id, Cluster.canonical_title, Cluster.top_category,
               Cluster.score, Cluster.last_updated)
        .where(Cluster.canonical_title.ilike(pattern))
        .order_by(desc(Cluster.score))
        .limit(20)
    )
    cl_result = await db.execute(cl_q)
    clusters = cl_result.all()

    # Rank and merge suggestions
    suggestions: list[dict[str, Any]] = []
    seen_titles: set[str] = set()

    # Rank clusters first (they represent story groups)
    for cl in clusters:
        title_norm = cl.canonical_title.lower().strip()
        if title_norm in seen_titles:
            continue
        seen_titles.add(title_norm)

        rel = _text_relevance(cl.canonical_title, q)
        rec = _recency_score(cl.last_updated, now)
        boost = _cluster_boost(cl.score)
        rank = _combined_rank(rel, rec, boost)

        suggestions.append({
            "type": "cluster",
            "id": cl.cluster_id,
            "title": cl.canonical_title,
            "category": cl.top_category,
            "score": round(rank, 4),
        })

    # Rank articles
    for art in articles:
        title_norm = art.title.lower().strip()
        if title_norm in seen_titles:
            continue
        seen_titles.add(title_norm)

        rel = _text_relevance(art.title, q)
        rec = _recency_score(art.published_at, now)
        # Articles without cluster get no cluster boost
        rank = _combined_rank(rel, rec, 0.0)

        suggestions.append({
            "type": "article",
            "id": art.id,
            "title": art.title,
            "source": art.source,
            "category": art.category,
            "image_url": art.image_url,
            "score": round(rank, 4),
        })

    # Sort by combined rank descending, take top N
    suggestions.sort(key=lambda x: x["score"], reverse=True)
    suggestions = suggestions[:MAX_SUGGESTIONS]

    result = {"query": q, "suggestions": suggestions}
    await cache_set(cache_key, result, SUGGEST_CACHE_TTL)
    return result


# ── Full search ──────────────────────────────────────────────────

async def search_articles(
    db: AsyncSession,
    query: str,
    category: str = "",
    country: str = "",
    limit: int = MAX_SEARCH_RESULTS,
    offset: int = 0,
) -> dict[str, Any]:
    """Full search with multi-signal ranking.

    Returns ranked articles with cluster info attached.
    """
    q = query.strip()
    if len(q) < 2:
        return {"query": q, "results": [], "total": 0}

    cache_key = f"search:full:{q.lower()}:{category}:{country}:{offset}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    pattern = f"%{q}%"
    now = datetime.now(timezone.utc)

    # Build conditions
    conditions = [Article.title.ilike(pattern)]
    if category:
        conditions.append(Article.category == category)
    if country:
        conditions.append(Article.country == country.upper())

    # Fetch candidates (generous limit for re-ranking)
    art_q = (
        select(Article)
        .where(*conditions)
        .order_by(desc(Article.published_at))
        .limit(200)
    )
    art_result = await db.execute(art_q)
    articles = list(art_result.scalars().all())

    # Fetch cluster info for articles that have clusters
    cluster_ids = {a.cluster_id for a in articles if a.cluster_id}
    cluster_map: dict[int, Cluster] = {}
    if cluster_ids:
        cl_q = select(Cluster).where(Cluster.cluster_id.in_(cluster_ids))
        cl_result = await db.execute(cl_q)
        for cl in cl_result.scalars().all():
            cluster_map[cl.cluster_id] = cl

    # Rank all candidates
    ranked: list[tuple[float, Article]] = []
    for art in articles:
        rel = _text_relevance(art.title, q)
        if rel == 0.0:
            continue
        rec = _recency_score(art.published_at, now)
        boost = 0.0
        if art.cluster_id and art.cluster_id in cluster_map:
            boost = _cluster_boost(cluster_map[art.cluster_id].score)
        rank = _combined_rank(rel, rec, boost)
        ranked.append((rank, art))

    ranked.sort(key=lambda x: x[0], reverse=True)

    # Source diversity: don't show >3 results from same source
    source_counts: dict[str, int] = {}
    diversified: list[tuple[float, Article]] = []
    for rank_score, art in ranked:
        sc = source_counts.get(art.source, 0)
        if sc >= 3:
            continue
        source_counts[art.source] = sc + 1
        diversified.append((rank_score, art))

    total = len(diversified)
    page = diversified[offset:offset + limit]

    results = []
    for rank_score, art in page:
        cluster_info = None
        if art.cluster_id and art.cluster_id in cluster_map:
            cl = cluster_map[art.cluster_id]
            cluster_info = {
                "cluster_id": cl.cluster_id,
                "canonical_title": cl.canonical_title,
                "ai_summary": cl.ai_summary,
                "score": cl.score,
            }

        results.append({
            "id": art.id,
            "title": art.title,
            "source": art.source,
            "url": art.url,
            "published_at": art.published_at.isoformat() if art.published_at else None,
            "country": art.country,
            "category": art.category,
            "image_url": art.image_url,
            "cluster_id": art.cluster_id,
            "relevance_score": round(rank_score, 4),
            "cluster": cluster_info,
        })

    result = {"query": q, "results": results, "total": total}
    await cache_set(cache_key, result, SEARCH_CACHE_TTL)
    return result
