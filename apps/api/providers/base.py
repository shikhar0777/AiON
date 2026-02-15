"""Base news provider interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from packages.shared.schemas import ArticleCreate


class NewsProvider(ABC):
    """Abstract base for all news data providers."""

    name: str = "base"

    @abstractmethod
    async def fetch_top_headlines(
        self,
        country: str = "US",
        category: str = "general",
        page_size: int = 20,
    ) -> list[ArticleCreate]:
        """Fetch top headlines for a country + category."""
        ...

    @abstractmethod
    async def fetch_search(
        self,
        query: str,
        page_size: int = 20,
    ) -> list[ArticleCreate]:
        """Search for articles matching a query."""
        ...

    @abstractmethod
    def is_configured(self) -> bool:
        """Check if this provider has the necessary API keys configured."""
        ...
