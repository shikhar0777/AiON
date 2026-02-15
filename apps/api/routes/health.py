"""Health and observability endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter

from apps.api.providers.router import get_provider_router
from apps.api.redis_client import get_redis

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    """Basic health check."""
    checks = {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

    # Check Redis
    try:
        r = await get_redis()
        await r.ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"
        checks["status"] = "degraded"

    return checks


@router.get("/health/providers")
async def provider_health():
    """Provider health status with circuit breaker states."""
    router = get_provider_router()
    statuses = await router.get_all_statuses()
    return {
        "providers": statuses,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
