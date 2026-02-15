"""Search endpoints — full search + fast autocomplete suggestions."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.database import get_db
from apps.api.services import search as search_service

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("/suggest")
async def suggest(
    q: str = Query("", min_length=2, max_length=200),
    db: AsyncSession = Depends(get_db),
):
    """Fast autocomplete suggestions for the search bar."""
    return await search_service.get_suggestions(db, q)


@router.get("")
async def search(
    q: str = Query("", min_length=2, max_length=200),
    category: str = Query("", max_length=50),
    country: str = Query("", max_length=5),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Full search with multi-signal ranking."""
    return await search_service.search_articles(db, q, category, country, limit, offset)
