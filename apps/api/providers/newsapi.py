"""NewsAPI provider implementation."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

from apps.api.config import get_settings
from apps.api.providers.base import NewsProvider
from packages.shared.schemas import ArticleCreate

logger = logging.getLogger(__name__)

NEWSAPI_BASE = "https://newsapi.org/v2"

# NewsAPI only supports these 7 categories on /top-headlines
NEWSAPI_SUPPORTED_CATEGORIES = {
    "general", "business", "entertainment", "health", "science", "sports", "technology"
}

# All other categories use /everything with keyword search
CATEGORY_SEARCH_KEYWORDS = {
    "politics": "politics OR government OR election OR policy OR congress OR parliament",
    "world": "international OR global OR world affairs OR geopolitics OR diplomacy",
    "economy": "economy OR GDP OR inflation OR recession OR economic growth OR trade deficit",
    "finance": "stock market OR Wall Street OR investment OR banking OR cryptocurrency OR IPO",
    "space": "space OR NASA OR SpaceX OR satellite OR Mars OR astronaut OR rocket launch",
    "cybersecurity": "cybersecurity OR hacking OR data breach OR ransomware OR cyber attack",
    "startups": "startup OR venture capital OR funding OR YCombinator OR unicorn OR seed round",
    "crypto": "cryptocurrency OR bitcoin OR ethereum OR blockchain OR DeFi OR NFT OR web3",
    "gaming": "video game OR gaming OR PlayStation OR Xbox OR Nintendo OR esports OR Steam",
    "ai": "artificial intelligence OR machine learning OR AI OR ChatGPT OR LLM OR deep learning",
    "education": "education OR university OR school OR students OR teacher OR curriculum",
    "environment": "climate change OR environment OR renewable energy OR pollution OR sustainability",
    "crime": "crime OR murder OR robbery OR arrest OR police OR investigation OR fraud",
    "legal": "court OR lawsuit OR judge OR verdict OR legal OR Supreme Court OR regulation",
    "religion": "religion OR church OR mosque OR temple OR faith OR Pope OR spiritual",
    "lifestyle": "lifestyle OR wellness OR self-care OR mindfulness OR work-life balance",
    "food": "food OR restaurant OR recipe OR cooking OR chef OR cuisine OR dining",
    "travel": "travel OR tourism OR airline OR hotel OR vacation OR destination OR flight",
    "fashion": "fashion OR designer OR runway OR clothing OR style OR luxury brand",
    "art": "art OR museum OR exhibition OR gallery OR painting OR sculpture OR artist",
    "automotive": "car OR automotive OR electric vehicle OR Tesla OR EV OR self-driving",
    "energy": "energy OR oil OR gas OR solar OR wind power OR nuclear OR OPEC",
    "real-estate": "real estate OR housing OR mortgage OR property OR rent OR home prices",
    "defense": "military OR defense OR army OR navy OR weapons OR NATO OR Pentagon",
    "agriculture": "agriculture OR farming OR crop OR harvest OR food supply OR livestock",
    "aviation": "aviation OR airline OR Boeing OR Airbus OR airport OR FAA OR flight",
    "media": "media OR journalism OR press OR newspaper OR broadcasting OR social media",
    "opinion": "opinion OR editorial OR commentary OR analysis OR perspective OR debate",
    "weather": "weather OR storm OR hurricane OR tornado OR flood OR drought OR forecast",
}


class NewsAPIProvider(NewsProvider):
    name = "newsapi"

    def __init__(self):
        self.settings = get_settings()

    def is_configured(self) -> bool:
        return bool(self.settings.newsapi_key)

    async def fetch_top_headlines(
        self,
        country: str = "US",
        category: str = "general",
        page_size: int = 20,
    ) -> list[ArticleCreate]:
        if not self.is_configured():
            return []

        # If category is supported by top-headlines, use it
        if category in NEWSAPI_SUPPORTED_CATEGORIES:
            return await self._fetch_headlines(country, category, page_size)
        else:
            # Use /everything with keyword search for all other categories
            keywords = CATEGORY_SEARCH_KEYWORDS.get(category, category)
            return await self._fetch_by_keyword(country, category, keywords, page_size)

    async def _fetch_headlines(
        self, country: str, category: str, page_size: int
    ) -> list[ArticleCreate]:
        """Fetch from /top-headlines for supported categories."""
        params = {
            "country": country.lower(),
            "category": category,
            "pageSize": min(page_size, 100),
            "apiKey": self.settings.newsapi_key,
        }

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(f"{NEWSAPI_BASE}/top-headlines", params=params)
                resp.raise_for_status()
                data = resp.json()

            articles = self._parse_articles(data, country, category)
            logger.info(f"NewsAPI: fetched {len(articles)} articles for {country}/{category} (headlines)")
            return articles

        except httpx.HTTPStatusError as e:
            logger.error(f"NewsAPI HTTP error: {e.response.status_code}")
            raise
        except Exception as e:
            logger.error(f"NewsAPI error: {e}")
            raise

    async def _fetch_by_keyword(
        self, country: str, category: str, keywords: str, page_size: int
    ) -> list[ArticleCreate]:
        """Fetch from /everything with keyword search for unsupported categories."""
        params = {
            "q": keywords,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": min(page_size, 100),
            "apiKey": self.settings.newsapi_key,
        }

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(f"{NEWSAPI_BASE}/everything", params=params)
                resp.raise_for_status()
                data = resp.json()

            articles = self._parse_articles(data, country, category)
            logger.info(f"NewsAPI: fetched {len(articles)} articles for {country}/{category} (keyword search)")
            return articles

        except httpx.HTTPStatusError as e:
            logger.error(f"NewsAPI HTTP error: {e.response.status_code}")
            raise
        except Exception as e:
            logger.error(f"NewsAPI error: {e}")
            raise

    def _parse_articles(
        self, data: dict, country: str, category: str
    ) -> list[ArticleCreate]:
        """Parse NewsAPI response into ArticleCreate objects."""
        articles = []
        for item in data.get("articles", []):
            if not item.get("title") or item["title"] == "[Removed]":
                continue
            pub_at = None
            if item.get("publishedAt"):
                try:
                    pub_at = datetime.fromisoformat(
                        item["publishedAt"].replace("Z", "+00:00")
                    )
                except (ValueError, TypeError):
                    pub_at = datetime.now(timezone.utc)

            articles.append(
                ArticleCreate(
                    provider=self.name,
                    source=item.get("source", {}).get("name", "Unknown"),
                    title=item["title"],
                    url=item.get("url", ""),
                    published_at=pub_at,
                    country=country.upper(),
                    category=category,
                    raw_snippet=item.get("description", ""),
                    image_url=item.get("urlToImage"),
                )
            )
        return articles

    async def fetch_search(
        self,
        query: str,
        page_size: int = 20,
    ) -> list[ArticleCreate]:
        if not self.is_configured():
            return []

        params = {
            "q": query,
            "pageSize": min(page_size, 100),
            "sortBy": "relevancy",
            "apiKey": self.settings.newsapi_key,
        }

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(f"{NEWSAPI_BASE}/everything", params=params)
                resp.raise_for_status()
                data = resp.json()

            articles = []
            for item in data.get("articles", []):
                if not item.get("title") or item["title"] == "[Removed]":
                    continue
                pub_at = None
                if item.get("publishedAt"):
                    try:
                        pub_at = datetime.fromisoformat(
                            item["publishedAt"].replace("Z", "+00:00")
                        )
                    except (ValueError, TypeError):
                        pass

                articles.append(
                    ArticleCreate(
                        provider=self.name,
                        source=item.get("source", {}).get("name", "Unknown"),
                        title=item["title"],
                        url=item.get("url", ""),
                        published_at=pub_at,
                        raw_snippet=item.get("description", ""),
                        image_url=item.get("urlToImage"),
                    )
                )
            return articles

        except Exception as e:
            logger.error(f"NewsAPI search error: {e}")
            raise
