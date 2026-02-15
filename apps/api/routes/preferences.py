"""User preferences routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.auth import get_current_user
from apps.api.database import User, UserPreference, get_db
from packages.shared.schemas import PreferencesRead, PreferencesUpdate

router = APIRouter(prefix="/api/preferences", tags=["preferences"])


@router.get("", response_model=PreferencesRead)
async def get_preferences(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == user.id)
    )
    prefs = result.scalar_one_or_none()
    if prefs is None:
        # Auto-create if missing
        prefs = UserPreference(user_id=user.id)
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)
    return PreferencesRead.model_validate(prefs)


@router.put("", response_model=PreferencesRead)
async def update_preferences(
    body: PreferencesUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == user.id)
    )
    prefs = result.scalar_one_or_none()
    if prefs is None:
        prefs = UserPreference(user_id=user.id)
        db.add(prefs)

    if body.categories is not None:
        prefs.categories = body.categories
    if body.countries is not None:
        prefs.countries = body.countries
    if body.notification_interval is not None:
        prefs.notification_interval = body.notification_interval

    await db.commit()
    await db.refresh(prefs)
    return PreferencesRead.model_validate(prefs)
