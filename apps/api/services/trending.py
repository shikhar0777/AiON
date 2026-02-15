"""Trending score computation service."""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.database import Article, Cluster, ClusterMember
from packages.shared.constants import TRENDING_W_RECENCY, TRENDING_W_SOURCES, TRENDING_W_VELOCITY

logger = logging.getLogger(__name__)


def compute_trending_score(
    unique_sources: int,
    newest_article_age_minutes: float,
    velocity: float,  # new articles in last 30 min
) -> float:
    """
    score = w1 * log(1 + unique_sources) + w2 * recency_boost + w3 * velocity
    recency_boost decays by minutes
    """
    source_score = TRENDING_W_SOURCES * math.log(1 + unique_sources)

    # Recency: 1.0 for <5min, decays to ~0.1 for 24h old
    if newest_article_age_minutes <= 0:
        recency = 1.0
    else:
        recency = 1.0 / (1.0 + (newest_article_age_minutes / 60.0))
    recency_score = TRENDING_W_RECENCY * recency

    velocity_score = TRENDING_W_VELOCITY * math.log(1 + velocity)

    return round(source_score + recency_score + velocity_score, 4)


async def update_trending_scores(db: AsyncSession) -> int:
    """Recompute trending scores for all active clusters."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=48)
    velocity_window = now - timedelta(minutes=30)

    # Get active clusters
    result = await db.execute(
        select(Cluster).where(Cluster.last_updated >= cutoff).limit(500)
    )
    clusters = list(result.scalars().all())

    updated = 0
    for cluster in clusters:
        # Count unique sources
        src_result = await db.execute(
            select(func.count(func.distinct(ClusterMember.source)))
            .where(ClusterMember.cluster_id == cluster.cluster_id)
        )
        unique_sources = src_result.scalar() or 1

        # Get newest article timestamp
        newest_result = await db.execute(
            select(func.max(Article.published_at))
            .where(Article.cluster_id == cluster.cluster_id)
        )
        newest_at = newest_result.scalar()
        if newest_at:
            if newest_at.tzinfo is None:
                newest_at = newest_at.replace(tzinfo=timezone.utc)
            age_minutes = max(0, (now - newest_at).total_seconds() / 60.0)
        else:
            age_minutes = 1440  # 24h fallback

        # Velocity: articles added in last 30 min
        vel_result = await db.execute(
            select(func.count(Article.id))
            .where(
                and_(
                    Article.cluster_id == cluster.cluster_id,
                    Article.fetched_at >= velocity_window,
                )
            )
        )
        velocity = vel_result.scalar() or 0

        new_score = compute_trending_score(unique_sources, age_minutes, velocity)
        cluster.score = new_score
        updated += 1

    await db.commit()
    logger.info(f"Updated trending scores for {updated} clusters")
    return updated
