"""Visa Developer API client with demo data fallback.

Uses mTLS when credentials are configured; returns realistic demo data otherwise.
"""

from __future__ import annotations

import logging
from typing import Any

from apps.api.config import get_settings
from apps.api.redis_client import cache_get, cache_set

logger = logging.getLogger("aion.visa")

# ── Demo data ────────────────────────────────────────────────────

DEMO_FX_RATES: list[dict[str, Any]] = [
    {"currency": "EUR", "name": "Euro", "rate": 0.9218, "inverse": 1.0848},
    {"currency": "GBP", "name": "British Pound", "rate": 0.7891, "inverse": 1.2673},
    {"currency": "JPY", "name": "Japanese Yen", "rate": 149.85, "inverse": 0.00667},
    {"currency": "CHF", "name": "Swiss Franc", "rate": 0.8812, "inverse": 1.1348},
    {"currency": "CAD", "name": "Canadian Dollar", "rate": 1.3572, "inverse": 0.7368},
    {"currency": "AUD", "name": "Australian Dollar", "rate": 1.5438, "inverse": 0.6478},
    {"currency": "CNY", "name": "Chinese Yuan", "rate": 7.2485, "inverse": 0.1380},
    {"currency": "INR", "name": "Indian Rupee", "rate": 83.12, "inverse": 0.01203},
    {"currency": "SGD", "name": "Singapore Dollar", "rate": 1.3421, "inverse": 0.7451},
    {"currency": "KRW", "name": "South Korean Won", "rate": 1328.50, "inverse": 0.000753},
    {"currency": "BRL", "name": "Brazilian Real", "rate": 4.9715, "inverse": 0.2011},
    {"currency": "MXN", "name": "Mexican Peso", "rate": 17.1250, "inverse": 0.05839},
]

DEMO_SPEND_INSIGHTS: list[dict[str, Any]] = [
    {"category": "Grocery", "sales_mom": 3.2, "sales_yoy": 7.8, "txn_mom": 1.5, "txn_yoy": 5.2},
    {"category": "Restaurants", "sales_mom": 5.1, "sales_yoy": 12.4, "txn_mom": 4.3, "txn_yoy": 9.8},
    {"category": "Gas Stations", "sales_mom": -2.1, "sales_yoy": -8.3, "txn_mom": 0.8, "txn_yoy": -1.2},
    {"category": "Hotels", "sales_mom": 6.7, "sales_yoy": 15.3, "txn_mom": 5.9, "txn_yoy": 11.7},
    {"category": "Airlines", "sales_mom": 8.4, "sales_yoy": 22.1, "txn_mom": 7.2, "txn_yoy": 18.5},
    {"category": "E-Commerce", "sales_mom": 4.6, "sales_yoy": 19.7, "txn_mom": 6.1, "txn_yoy": 21.3},
    {"category": "Healthcare", "sales_mom": 1.8, "sales_yoy": 4.5, "txn_mom": 2.3, "txn_yoy": 3.9},
    {"category": "Entertainment", "sales_mom": 3.9, "sales_yoy": 10.2, "txn_mom": 5.5, "txn_yoy": 13.1},
]

DEMO_PAYMENT_VOLUME: list[dict[str, Any]] = [
    {"month": "Sep 2025", "volume_trillions": 2.31},
    {"month": "Oct 2025", "volume_trillions": 2.45},
    {"month": "Nov 2025", "volume_trillions": 2.68},
    {"month": "Dec 2025", "volume_trillions": 2.91},
    {"month": "Jan 2026", "volume_trillions": 2.52},
    {"month": "Feb 2026", "volume_trillions": 2.63},
]

# ── Cache TTLs ───────────────────────────────────────────────────

CACHE_TTL_FX = 300       # 5 minutes
CACHE_TTL_SPEND = 600    # 10 minutes
CACHE_TTL_VOLUME = 600   # 10 minutes


def is_configured() -> bool:
    """Check if Visa API credentials are present."""
    s = get_settings()
    return bool(s.visa_user_id and s.visa_password and s.visa_cert_path and s.visa_key_path)


async def _call_visa_api(path: str) -> dict[str, Any]:
    """Make an authenticated mTLS request to the Visa sandbox."""
    import httpx

    s = get_settings()
    url = f"{s.visa_base_url}{path}"
    logger.info("Visa API call: %s", url)

    async with httpx.AsyncClient(
        cert=(s.visa_cert_path, s.visa_key_path),
        verify=s.visa_ca_cert_path or True,
        auth=(s.visa_user_id, s.visa_password),
        timeout=15.0,
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()


async def get_fx_rates(source: str = "USD") -> dict[str, Any]:
    """Return FX rates — live if configured, demo otherwise."""
    cache_key = f"visa:fx:{source}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    if is_configured():
        try:
            data = await _call_visa_api(f"/forexrates/v2/foreignexchangerates?sourceCurrencyCode={source}")
            result = {"source": source, "rates": data.get("fxRateResponse", []), "demo": False}
            await cache_set(cache_key, result, CACHE_TTL_FX)
            return result
        except Exception as e:
            logger.warning("Visa FX API failed, falling back to demo: %s", e)

    result = {"source": source, "rates": DEMO_FX_RATES, "demo": True}
    await cache_set(cache_key, result, CACHE_TTL_FX)
    return result


async def get_spend_insights(country: str = "US") -> dict[str, Any]:
    """Return spending insights — live if configured, demo otherwise."""
    cache_key = f"visa:spend:{country}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    if is_configured():
        try:
            data = await _call_visa_api(f"/merchantmeasurement/v1/merchantbenchmark?country={country}")
            result = {"country": country, "insights": data.get("merchantBenchmarkResponse", []), "demo": False}
            await cache_set(cache_key, result, CACHE_TTL_SPEND)
            return result
        except Exception as e:
            logger.warning("Visa spend API failed, falling back to demo: %s", e)

    result = {"country": country, "insights": DEMO_SPEND_INSIGHTS, "demo": True}
    await cache_set(cache_key, result, CACHE_TTL_SPEND)
    return result


async def get_payment_volume() -> dict[str, Any]:
    """Return payment volume trend — live if configured, demo otherwise."""
    cache_key = "visa:volume"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    if is_configured():
        try:
            data = await _call_visa_api("/paymentanalytics/v1/paymentvolume")
            result = {"months": data.get("paymentVolumeResponse", []), "demo": False}
            await cache_set(cache_key, result, CACHE_TTL_VOLUME)
            return result
        except Exception as e:
            logger.warning("Visa volume API failed, falling back to demo: %s", e)

    result = {"months": DEMO_PAYMENT_VOLUME, "demo": True}
    await cache_set(cache_key, result, CACHE_TTL_VOLUME)
    return result
