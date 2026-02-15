"""Provider Router with priority failover and circuit breaker."""

from __future__ import annotations

import logging
from typing import Optional

from apps.api.providers.base import NewsProvider
from apps.api.providers.gdelt import GDELTProvider
from apps.api.providers.guardian import GuardianProvider
from apps.api.providers.newsapi import NewsAPIProvider
from apps.api.redis_client import CircuitBreaker
from packages.shared.schemas import ArticleCreate

logger = logging.getLogger(__name__)


class ProviderRouter:
    """Routes requests to news providers with priority-based failover.

    Priority for top headlines: NewsAPI → Guardian → GDELT
    Priority for trending/global: GDELT → Guardian → NewsAPI
    """

    def __init__(self):
        self.providers: dict[str, NewsProvider] = {
            "newsapi": NewsAPIProvider(),
            "guardian": GuardianProvider(),
            "gdelt": GDELTProvider(),
        }
        self.breakers: dict[str, CircuitBreaker] = {
            name: CircuitBreaker(name) for name in self.providers
        }
        # Priority chains
        self.headlines_chain = ["newsapi", "guardian", "gdelt"]
        self.trending_chain = ["gdelt", "guardian", "newsapi"]

    async def fetch_headlines(
        self,
        country: str = "US",
        category: str = "general",
        page_size: int = 20,
    ) -> tuple[list[ArticleCreate], list[str]]:
        """Fetch headlines using priority chain. Returns (articles, providers_used)."""
        return await self._fetch_with_chain(
            self.headlines_chain,
            "fetch_top_headlines",
            country=country,
            category=category,
            page_size=page_size,
        )

    async def fetch_trending(
        self,
        country: str = "US",
        category: str = "general",
        page_size: int = 30,
    ) -> tuple[list[ArticleCreate], list[str]]:
        """Fetch trending articles using priority chain."""
        return await self._fetch_with_chain(
            self.trending_chain,
            "fetch_top_headlines",
            country=country,
            category=category,
            page_size=page_size,
        )

    async def fetch_all_sources(
        self,
        country: str = "US",
        category: str = "general",
        page_size: int = 20,
    ) -> tuple[list[ArticleCreate], list[str]]:
        """Fetch from ALL available providers for maximum coverage (used by worker)."""
        all_articles: list[ArticleCreate] = []
        providers_used: list[str] = []

        for name in self.providers:
            provider = self.providers[name]
            breaker = self.breakers[name]

            if not provider.is_configured():
                continue
            if await breaker.is_open():
                logger.warning(f"Circuit open for {name}, skipping")
                continue

            try:
                articles = await provider.fetch_top_headlines(
                    country=country, category=category, page_size=page_size
                )
                await breaker.record_success()
                all_articles.extend(articles)
                providers_used.append(name)
            except Exception as e:
                await breaker.record_failure(str(e))
                logger.error(f"Provider {name} failed: {e}")

        return all_articles, providers_used

    async def _fetch_with_chain(
        self,
        chain: list[str],
        method: str,
        **kwargs,
    ) -> tuple[list[ArticleCreate], list[str]]:
        """Try providers in chain order. Use first successful result, but try to aggregate."""
        all_articles: list[ArticleCreate] = []
        providers_used: list[str] = []

        for name in chain:
            provider = self.providers[name]
            breaker = self.breakers[name]

            if not provider.is_configured():
                continue
            if await breaker.is_open():
                logger.warning(f"Circuit open for {name}, skipping in chain")
                continue

            try:
                fn = getattr(provider, method)
                articles = await fn(**kwargs)
                await breaker.record_success()

                if articles:
                    all_articles.extend(articles)
                    providers_used.append(name)
                    # If we got a good batch from the first provider, return
                    # but still try remaining if we have few results
                    if len(all_articles) >= kwargs.get("page_size", 20):
                        break
            except Exception as e:
                await breaker.record_failure(str(e))
                logger.error(f"Provider {name} failed in chain: {e}")
                continue  # Try next in chain

        return all_articles, providers_used

    async def get_all_statuses(self) -> list[dict]:
        statuses = []
        for name, breaker in self.breakers.items():
            status = await breaker.get_status()
            status["configured"] = self.providers[name].is_configured()
            statuses.append(status)
        return statuses


# Singleton
_router: Optional[ProviderRouter] = None


def get_provider_router() -> ProviderRouter:
    global _router
    if _router is None:
        _router = ProviderRouter()
    return _router
