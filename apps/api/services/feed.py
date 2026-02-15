"""Feed service — assembles feed responses from DB + cache."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.database import Article, Cluster, ClusterMember
from apps.api.redis_client import cache_get_with_stale, cache_set_with_stale
from packages.shared.constants import CACHE_TTL_FEED
from packages.shared.schemas import FeedItem, FeedResponse

logger = logging.getLogger(__name__)

ENGLISH_LANGUAGE_VALUES = ("en", "english", "eng")


def _is_english_language_clause():
    return or_(
        Article.language.is_(None),
        func.lower(Article.language).in_(ENGLISH_LANGUAGE_VALUES),
    )


async def get_feed(
    db: AsyncSession,
    country: str = "",
    category: str = "general",
    mode: str = "trending",
    cursor: int = 0,
    limit: int = 30,
) -> FeedResponse:
    """Get feed items for a country/category/mode combination.

    If country is empty, returns global results across all countries.
    """

    cache_key = f"feed:{country or 'GLOBAL'}:{category}:{mode}:lang-en"

    # Check cache first
    cached, is_stale = await cache_get_with_stale(cache_key)
    if cached and not is_stale:
        resp = FeedResponse(**cached)
        resp.cached = True
        return resp

    # Build query based on mode
    if mode == "trending":
        items = await _trending_feed(db, country, category, cursor, limit)
    else:
        items = await _latest_feed(db, country, category, cursor, limit)

    response = FeedResponse(
        items=items,
        total=len(items),
        cursor=str(cursor + limit) if len(items) >= limit else None,
        updated_at=datetime.now(timezone.utc),
        sources_used=[],
        cached=False,
    )

    # Cache the response
    await cache_set_with_stale(cache_key, response.model_dump(), ttl=CACHE_TTL_FEED)

    return response


async def _trending_feed(
    db: AsyncSession, country: str, category: str, offset: int, limit: int
) -> list[FeedItem]:
    """Get trending feed items by cluster score."""
    # Get top clusters — filter by country only if specified
    conditions = [Cluster.top_category == category]
    if country:
        conditions.append(Cluster.top_country == country.upper())
    cluster_q = (
        select(Cluster)
        .where(and_(*conditions))
        .order_by(desc(Cluster.score))
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(cluster_q)
    clusters = list(result.scalars().all())

    items = []
    for cluster in clusters:
        # Get the "best" article for this cluster (most recent with image)
        art_q = (
            select(Article)
            .where(
                and_(
                    Article.cluster_id == cluster.cluster_id,
                    _is_english_language_clause(),
                )
            )
            .order_by(desc(Article.published_at))
            .limit(1)
        )
        art_result = await db.execute(art_q)
        article = art_result.scalar_one_or_none()
        if not article:
            continue

        # Count articles in cluster
        count_q = select(func.count(Article.id)).where(
            Article.cluster_id == cluster.cluster_id
        )
        count_result = await db.execute(count_q)
        cluster_size = count_result.scalar() or 1

        items.append(
            FeedItem(
                id=article.id,
                title=cluster.canonical_title,
                source=article.source,
                url=article.url,
                published_at=article.published_at,
                country=article.country,
                category=article.category,
                image_url=article.image_url,
                cluster_id=cluster.cluster_id,
                cluster_size=cluster_size,
                score=cluster.score,
                ai_summary=cluster.ai_summary,
                why_trending=cluster.why_trending,
            )
        )

    return items


async def _latest_feed(
    db: AsyncSession, country: str, category: str, offset: int, limit: int
) -> list[FeedItem]:
    """Get latest articles by publish time."""
    conditions = [Article.category == category, _is_english_language_clause()]
    if country:
        conditions.append(Article.country == country.upper())
    query = (
        select(Article)
        .where(and_(*conditions))
        .order_by(desc(Article.published_at))
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    articles = list(result.scalars().all())

    items = []
    for article in articles:
        cluster_size = 1
        ai_summary = None
        score = 0.0

        if article.cluster_id:
            count_q = select(func.count(Article.id)).where(
                Article.cluster_id == article.cluster_id
            )
            count_result = await db.execute(count_q)
            cluster_size = count_result.scalar() or 1

            cluster_q = select(Cluster).where(
                Cluster.cluster_id == article.cluster_id
            )
            cluster_result = await db.execute(cluster_q)
            cluster = cluster_result.scalar_one_or_none()
            if cluster:
                ai_summary = cluster.ai_summary
                score = cluster.score

        items.append(
            FeedItem(
                id=article.id,
                title=article.title,
                source=article.source,
                url=article.url,
                published_at=article.published_at,
                country=article.country,
                category=article.category,
                image_url=article.image_url,
                cluster_id=article.cluster_id,
                cluster_size=cluster_size,
                score=score,
                ai_summary=ai_summary,
            )
        )

    return items
