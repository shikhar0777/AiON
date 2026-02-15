"""Enrich task — AI summarization + trending analysis for clusters.

Uses two separate AI providers for different tasks:
  - Claude (Anthropic): Cluster summarization — summary, key_points, entities
  - OpenAI (GPT-4o-mini): Trending analysis — why_trending, tags, sentiment
"""

from __future__ import annotations

import logging

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.ai.router import get_ai_router
from apps.api.database import Article, Cluster
from apps.api.redis_client import publish_event

logger = logging.getLogger(__name__)


async def enrich_clusters(db: AsyncSession, batch_size: int = 10):
    """Find clusters without AI summary and enrich them.

    Runs two AI calls per cluster:
      1. summarize_cluster() -> Claude (primary) for summary, key_points, entities
      2. analyze_trending()  -> OpenAI (primary) for why_trending, tags, sentiment

    Only enriches clusters with 2+ articles (worth summarizing).
    """
    from sqlalchemy import func

    # Find un-enriched clusters with articles
    subq = (
        select(Article.cluster_id, func.count(Article.id).label("cnt"))
        .group_by(Article.cluster_id)
        .having(func.count(Article.id) >= 2)
        .subquery()
    )

    result = await db.execute(
        select(Cluster)
        .join(subq, Cluster.cluster_id == subq.c.cluster_id)
        .where(Cluster.ai_summary.is_(None))
        .order_by(Cluster.score.desc())
        .limit(batch_size)
    )
    clusters = list(result.scalars().all())

    if not clusters:
        logger.debug("No clusters to enrich")
        return 0

    ai = get_ai_router()
    enriched = 0

    for cluster in clusters:
        try:
            # Get cluster's articles
            arts_result = await db.execute(
                select(Article)
                .where(Article.cluster_id == cluster.cluster_id)
                .order_by(Article.published_at.desc())
                .limit(10)
            )
            articles = list(arts_result.scalars().all())

            if not articles:
                continue

            titles = [a.title for a in articles]
            snippets = [a.raw_snippet or "" for a in articles]
            sources = [a.source for a in articles]

            # Step 1: Claude -> Summarization (summary, key_points, entities)
            summary_resp = await ai.summarize_cluster(titles, snippets, sources)
            cluster.ai_summary = summary_resp.summary
            cluster.ai_key_points_json = summary_resp.key_points
            cluster.ai_entities_json = summary_resp.entities

            # Step 2: OpenAI -> Trending analysis (why_trending, tags, sentiment)
            trending_resp = await ai.analyze_trending(titles, snippets, sources)
            cluster.why_trending = trending_resp["why_trending"]
            cluster.tags_json = trending_resp.get("tags", [])

            # Store extra trending metadata
            cluster.metadata_json = {
                "sentiment": trending_resp.get("sentiment", "neutral"),
                "impact_score": trending_resp.get("impact_score", 5),
                "summary_provider": "anthropic",
                "trending_provider": trending_resp.get("ai_provider", "openai"),
            }

            enriched += 1

            # Publish SSE event for this cluster update
            await publish_event(
                channel=f"{cluster.top_country}:{cluster.top_category}:trending",
                event_type="cluster_update",
                data={
                    "cluster_id": cluster.cluster_id,
                    "title": cluster.canonical_title,
                    "summary": summary_resp.summary,
                    "why_trending": trending_resp["why_trending"],
                    "tags": trending_resp.get("tags", []),
                    "score": cluster.score,
                },
            )

            logger.info(
                f"Enriched cluster {cluster.cluster_id}: "
                f"summary via Claude, trending via OpenAI"
            )

        except Exception as e:
            logger.error(f"Failed to enrich cluster {cluster.cluster_id}: {e}")
            continue

    await db.commit()
    logger.info(f"Enriched {enriched} clusters (Claude summaries + OpenAI trending)")
    return enriched
