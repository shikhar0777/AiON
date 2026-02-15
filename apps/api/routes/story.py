"""Story + Cluster + Explain endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.ai.router import get_ai_router
from apps.api.database import get_db, Article, Cluster
from apps.api.redis_client import cache_get, cache_set
from apps.api.services.story import get_cluster_detail, get_story
from packages.shared.constants import CACHE_TTL_EXPLAIN
from packages.shared.schemas import ClusterRead, ExplainResponse, StoryIntelligence

from sqlalchemy import select

router = APIRouter(prefix="/api", tags=["story"])


@router.get("/story/{article_id}")
async def story(
    article_id: int,
    db: AsyncSession = Depends(get_db),
) -> StoryIntelligence:
    result = await get_story(db, article_id)
    if not result:
        raise HTTPException(status_code=404, detail="Article not found")
    return result


@router.get("/cluster/{cluster_id}")
async def cluster(
    cluster_id: int,
    db: AsyncSession = Depends(get_db),
) -> ClusterRead:
    result = await get_cluster_detail(db, cluster_id)
    if not result:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return result


@router.get("/explain")
async def explain(
    cluster_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
) -> ExplainResponse:
    """Get AI-generated deep explanation for a story cluster."""
    cache_key = f"explain:{cluster_id}"
    cached = await cache_get(cache_key)
    if cached:
        return ExplainResponse(**cached)

    # Get cluster + top article
    cl_result = await db.execute(
        select(Cluster).where(Cluster.cluster_id == cluster_id)
    )
    cluster_obj = cl_result.scalar_one_or_none()
    if not cluster_obj:
        raise HTTPException(status_code=404, detail="Cluster not found")

    # Get top article for snippet
    art_result = await db.execute(
        select(Article)
        .where(Article.cluster_id == cluster_id)
        .order_by(Article.published_at.desc())
        .limit(1)
    )
    article = art_result.scalar_one_or_none()

    ai = get_ai_router()
    result = await ai.explain_story(
        title=cluster_obj.canonical_title,
        snippet=article.raw_snippet if article else "",
        source=article.source if article else "",
    )

    await cache_set(cache_key, result.model_dump(), ttl=CACHE_TTL_EXPLAIN)
    return result
