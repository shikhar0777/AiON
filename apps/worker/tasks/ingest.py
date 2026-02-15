"""Ingest task — polls news providers and stores articles."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.providers.router import get_provider_router
from apps.api.services.clustering import deduplicate_and_store
from packages.shared.constants import CATEGORIES, COUNTRIES

logger = logging.getLogger(__name__)

# Rotate through countries to spread API calls
_country_index = 0


async def ingest_news(db: AsyncSession, countries: list[str] | None = None, categories: list[str] | None = None):
    """Fetch news from all providers and store in database.

    Cycles through country/category combinations to spread API load.
    """
    global _country_index

    if countries is None:
        all_countries = list(COUNTRIES.keys())
        # Process 3 countries per cycle to avoid rate limits
        start = _country_index
        end = min(start + 3, len(all_countries))
        countries = all_countries[start:end]
        _country_index = end if end < len(all_countries) else 0

    if categories is None:
        categories = CATEGORIES

    router = get_provider_router()
    total_stored = 0

    for country in countries:
        for category in categories:
            try:
                articles, providers_used = await router.fetch_all_sources(
                    country=country, category=category, page_size=20
                )
                if articles:
                    stored = await deduplicate_and_store(db, articles)
                    total_stored += len(stored)
                    logger.info(
                        f"Ingested {len(stored)} articles for {country}/{category} "
                        f"from {providers_used}"
                    )
            except Exception as e:
                logger.error(f"Ingest failed for {country}/{category}: {e}")
                continue

    logger.info(f"Ingest cycle complete: {total_stored} new articles stored")
    return total_stored
