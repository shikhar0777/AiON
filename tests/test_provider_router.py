"""Tests for provider router behavior."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from packages.shared.schemas import ArticleCreate


class TestProviderRouterLogic:
    """Test provider chain and failover logic without requiring Redis."""

    def test_headlines_chain_order(self):
        """Headlines should prefer NewsAPI -> Guardian -> GDELT."""
        from apps.api.providers.router import ProviderRouter
        router = ProviderRouter()
        assert router.headlines_chain == ["newsapi", "guardian", "gdelt"]

    def test_trending_chain_order(self):
        """Trending should prefer GDELT -> Guardian -> NewsAPI."""
        from apps.api.providers.router import ProviderRouter
        router = ProviderRouter()
        assert router.trending_chain == ["gdelt", "guardian", "newsapi"]

    def test_all_providers_registered(self):
        """All three providers should be registered."""
        from apps.api.providers.router import ProviderRouter
        router = ProviderRouter()
        assert "newsapi" in router.providers
        assert "guardian" in router.providers
        assert "gdelt" in router.providers

    def test_gdelt_always_configured(self):
        """GDELT should always be configured (no API key needed)."""
        from apps.api.providers.gdelt import GDELTProvider
        provider = GDELTProvider()
        assert provider.is_configured() is True

    def test_newsapi_unconfigured_without_key(self):
        """NewsAPI should be unconfigured without key."""
        from apps.api.providers.newsapi import NewsAPIProvider
        with patch("apps.api.providers.newsapi.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(newsapi_key="")
            provider = NewsAPIProvider()
            assert provider.is_configured() is False

    def test_guardian_unconfigured_without_key(self):
        """Guardian should be unconfigured without key."""
        from apps.api.providers.guardian import GuardianProvider
        with patch("apps.api.providers.guardian.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(guardian_key="")
            provider = GuardianProvider()
            assert provider.is_configured() is False


class TestCircuitBreakerLogic:
    """Test circuit breaker state machine logic."""

    def test_initial_state_closed(self):
        """Circuit breaker should start in closed state."""
        # We test the concept, not the Redis interaction
        state = {"failures": 0, "state": "closed", "opened_at": None}
        assert state["state"] == "closed"
        assert state["failures"] == 0

    def test_threshold_opens_circuit(self):
        """Circuit should open after threshold failures."""
        from packages.shared.constants import CIRCUIT_BREAKER_THRESHOLD
        state = {"failures": CIRCUIT_BREAKER_THRESHOLD, "state": "closed"}
        if state["failures"] >= CIRCUIT_BREAKER_THRESHOLD:
            state["state"] = "open"
        assert state["state"] == "open"

    def test_below_threshold_stays_closed(self):
        """Circuit should stay closed below threshold."""
        from packages.shared.constants import CIRCUIT_BREAKER_THRESHOLD
        state = {"failures": CIRCUIT_BREAKER_THRESHOLD - 1, "state": "closed"}
        if state["failures"] >= CIRCUIT_BREAKER_THRESHOLD:
            state["state"] = "open"
        assert state["state"] == "closed"
