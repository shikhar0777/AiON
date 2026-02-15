"""Notification generation — check user preferences and create notifications for matching articles."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.database import Article, Notification, UserPreference

logger = logging.getLogger("worker.notify")

MAX_NOTIFICATIONS_PER_BATCH = 5


async def generate_notifications(db: AsyncSession) -> int:
    """Check all users with preferences and create notifications for new matching articles."""
    now = datetime.now(timezone.utc)
    created_count = 0

    # Fetch all user preferences that have at least one category
    result = await db.execute(
        select(UserPreference).where(
            UserPreference.categories != None,  # noqa: E711
        )
    )
    all_prefs = result.scalars().all()

    for prefs in all_prefs:
        categories = prefs.categories or []
        countries = prefs.countries or []
        interval = prefs.notification_interval or 15

        # Skip users with no categories set
        if not categories:
            continue

        # Debounce: skip if notified too recently
        if prefs.last_notified_at:
            next_allowed = prefs.last_notified_at + timedelta(minutes=interval)
            if now < next_allowed:
                continue

        # Find articles since last notification (or last 30 minutes for new users)
        since = prefs.last_notified_at or (now - timedelta(minutes=30))

        # Build query for matching articles
        conditions = [
            Article.fetched_at > since,
            Article.category.in_(categories),
        ]
        if countries:
            conditions.append(Article.country.in_(countries))

        articles_result = await db.execute(
            select(Article)
            .where(and_(*conditions))
            .order_by(Article.fetched_at.desc())
            .limit(MAX_NOTIFICATIONS_PER_BATCH)
        )
        articles = articles_result.scalars().all()

        if not articles:
            continue

        # Create notification rows
        for article in articles:
            notif = Notification(
                user_id=prefs.user_id,
                article_id=article.id,
                cluster_id=article.cluster_id,
                title=article.title,
                body=article.raw_snippet[:200] if article.raw_snippet else None,
                category=article.category,
                country=article.country,
            )
            db.add(notif)
            created_count += 1

        # Update last_notified_at
        prefs.last_notified_at = now

    await db.commit()
    if created_count > 0:
        logger.info(f"Created {created_count} notifications for {len(all_prefs)} users")
    return created_count
