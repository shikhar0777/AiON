"""Feed endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.database import get_db
from apps.api.services.feed import get_feed
from packages.shared.constants import CATEGORIES
from packages.shared.schemas import FeedResponse

router = APIRouter(prefix="/api", tags=["feed"])


@router.get("/feed")
async def feed(
    country: str = Query("", max_length=5),
    category: str = Query("general", max_length=50),
    mode: str = Query("trending", pattern="^(trending|latest)$"),
    cursor: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> FeedResponse:
    cat = category.lower()
    if cat not in CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category '{category}'. Must be one of: {', '.join(CATEGORIES)}",
        )
    return await get_feed(
        db=db,
        country=country.upper().strip() if country.strip() else "",
        category=cat,
        mode=mode,
        cursor=cursor,
        limit=limit,
    )
