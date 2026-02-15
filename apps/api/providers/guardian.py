"""Guardian API provider implementation."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

from apps.api.config import get_settings
from apps.api.providers.base import NewsProvider
from packages.shared.constants import GUARDIAN_SECTION_MAP
from packages.shared.schemas import ArticleCreate

logger = logging.getLogger(__name__)

GUARDIAN_BASE = "https://content.guardianapis.com"


class GuardianProvider(NewsProvider):
    name = "guardian"

    def __init__(self):
        self.settings = get_settings()

    def is_configured(self) -> bool:
        return bool(self.settings.guardian_key)

    async def fetch_top_headlines(
        self,
        country: str = "US",
        category: str = "general",
        page_size: int = 20,
    ) -> list[ArticleCreate]:
        if not self.is_configured():
            return []

        section = GUARDIAN_SECTION_MAP.get(category, "news")

        params = {
            "section": section,
            "page-size": min(page_size, 50),
            "order-by": "newest",
            "show-fields": "trailText,thumbnail",
            "api-key": self.settings.guardian_key,
        }

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(f"{GUARDIAN_BASE}/search", params=params)
                resp.raise_for_status()
                data = resp.json()

            articles = []
            for item in data.get("response", {}).get("results", []):
                if not item.get("webTitle"):
                    continue
                pub_at = None
                if item.get("webPublicationDate"):
                    try:
                        pub_at = datetime.fromisoformat(
                            item["webPublicationDate"].replace("Z", "+00:00")
                        )
                    except (ValueError, TypeError):
                        pub_at = datetime.now(timezone.utc)

                fields = item.get("fields", {})
                articles.append(
                    ArticleCreate(
                        provider=self.name,
                        source="The Guardian",
                        title=item["webTitle"],
                        url=item.get("webUrl", ""),
                        published_at=pub_at,
                        country=country.upper(),
                        category=category,
                        raw_snippet=fields.get("trailText", ""),
                        image_url=fields.get("thumbnail"),
                    )
                )
            logger.info(f"Guardian: fetched {len(articles)} articles for {section}")
            return articles

        except httpx.HTTPStatusError as e:
            logger.error(f"Guardian HTTP error: {e.response.status_code}")
            raise
        except Exception as e:
            logger.error(f"Guardian error: {e}")
            raise

    async def fetch_search(
        self,
        query: str,
        page_size: int = 20,
    ) -> list[ArticleCreate]:
        if not self.is_configured():
            return []

        params = {
            "q": query,
            "page-size": min(page_size, 50),
            "order-by": "relevance",
            "show-fields": "trailText,thumbnail",
            "api-key": self.settings.guardian_key,
        }

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(f"{GUARDIAN_BASE}/search", params=params)
                resp.raise_for_status()
                data = resp.json()

            articles = []
            for item in data.get("response", {}).get("results", []):
                if not item.get("webTitle"):
                    continue
                pub_at = None
                if item.get("webPublicationDate"):
                    try:
                        pub_at = datetime.fromisoformat(
                            item["webPublicationDate"].replace("Z", "+00:00")
                        )
                    except (ValueError, TypeError):
                        pass

                fields = item.get("fields", {})
                articles.append(
                    ArticleCreate(
                        provider=self.name,
                        source="The Guardian",
                        title=item["webTitle"],
                        url=item.get("webUrl", ""),
                        published_at=pub_at,
                        raw_snippet=fields.get("trailText", ""),
                        image_url=fields.get("thumbnail"),
                    )
                )
            return articles

        except Exception as e:
            logger.error(f"Guardian search error: {e}")
            raise
