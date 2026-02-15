"""Redis client for caching, pub/sub, and circuit breaker state.

All functions gracefully degrade when Redis is unavailable — the app
works without Redis, just without caching/streams.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime
from typing import Optional

import redis.asyncio as aioredis

from apps.api.config import get_settings
from packages.shared.constants import (
    CACHE_TTL_FEED,
    CIRCUIT_BREAKER_COOLDOWN,
    CIRCUIT_BREAKER_THRESHOLD,
)

logger = logging.getLogger("aion.redis")

_redis: Optional[aioredis.Redis] = None
_redis_available: bool = True


async def get_redis() -> Optional[aioredis.Redis]:
    global _redis, _redis_available
    if not _redis_available:
        return None
    if _redis is None:
        settings = get_settings()
        if not settings.redis_url:
            logger.warning("REDIS_URL not set — running without Redis")
            _redis_available = False
            return None
        try:
            _redis = aioredis.from_url(
                settings.redis_url, decode_responses=True, max_connections=20
            )
            await _redis.ping()
        except Exception as e:
            logger.warning("Redis unavailable (%s) — running without cache", e)
            _redis_available = False
            _redis = None
            return None
    return _redis


async def close_redis():
    global _redis
    if _redis:
        await _redis.close()
        _redis = None


# ── Cache helpers ────────────────────────────────────────────────
async def cache_get(key: str) -> Optional[dict]:
    try:
        r = await get_redis()
        if r is None:
            return None
        raw = await r.get(f"cache:{key}")
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    return None


async def cache_set(key: str, data: dict, ttl: int = CACHE_TTL_FEED):
    try:
        r = await get_redis()
        if r is None:
            return
        await r.set(f"cache:{key}", json.dumps(data, default=str), ex=ttl)
    except Exception:
        pass


async def cache_get_with_stale(key: str, stale_ttl: int = 600) -> tuple[Optional[dict], bool]:
    """Get cached data, returning stale data if fresh cache expired."""
    try:
        r = await get_redis()
        if r is None:
            return None, False
        raw = await r.get(f"cache:{key}")
        if raw:
            return json.loads(raw), False
        raw_stale = await r.get(f"stale:{key}")
        if raw_stale:
            return json.loads(raw_stale), True
    except Exception:
        pass
    return None, False


async def cache_set_with_stale(key: str, data: dict, ttl: int = CACHE_TTL_FEED, stale_ttl: int = 600):
    try:
        r = await get_redis()
        if r is None:
            return
        serialized = json.dumps(data, default=str)
        pipe = r.pipeline()
        pipe.set(f"cache:{key}", serialized, ex=ttl)
        pipe.set(f"stale:{key}", serialized, ex=ttl + stale_ttl)
        await pipe.execute()
    except Exception:
        pass


# ── Circuit Breaker ──────────────────────────────────────────────
class CircuitBreaker:
    """Per-provider circuit breaker using Redis state."""

    def __init__(self, provider_name: str):
        self.provider = provider_name
        self.key = f"cb:{provider_name}"

    async def _state(self) -> dict:
        try:
            r = await get_redis()
            if r is None:
                return {"failures": 0, "state": "closed", "opened_at": None, "last_error": None}
            raw = await r.get(self.key)
            if raw:
                return json.loads(raw)
        except Exception:
            pass
        return {"failures": 0, "state": "closed", "opened_at": None, "last_error": None}

    async def _save(self, state: dict):
        try:
            r = await get_redis()
            if r is None:
                return
            await r.set(self.key, json.dumps(state, default=str), ex=CIRCUIT_BREAKER_COOLDOWN * 10)
        except Exception:
            pass

    async def is_open(self) -> bool:
        state = await self._state()
        if state["state"] == "open":
            opened = state.get("opened_at", 0)
            if time.time() - opened > CIRCUIT_BREAKER_COOLDOWN:
                state["state"] = "half_open"
                await self._save(state)
                return False
            return True
        return False

    async def record_success(self):
        state = await self._state()
        state["failures"] = 0
        state["state"] = "closed"
        await self._save(state)

    async def record_failure(self, error: str = ""):
        state = await self._state()
        state["failures"] = state.get("failures", 0) + 1
        state["last_error"] = error
        if state["failures"] >= CIRCUIT_BREAKER_THRESHOLD:
            state["state"] = "open"
            state["opened_at"] = time.time()
        await self._save(state)

    async def get_status(self) -> dict:
        state = await self._state()
        return {
            "name": self.provider,
            "status": state["state"],
            "failures": state["failures"],
            "last_error": state.get("last_error"),
            "cooldown_until": (
                datetime.fromtimestamp(state["opened_at"] + CIRCUIT_BREAKER_COOLDOWN).isoformat()
                if state.get("opened_at") and state["state"] == "open"
                else None
            ),
        }


# ── Streams (replaces Pub/Sub for SSE) ───────────────────────────
async def stream_add(channel: str, data: dict, maxlen: int = 1000) -> str:
    """Append an event to a Redis Stream."""
    try:
        r = await get_redis()
        if r is None:
            return "0-0"
        stream_key = f"stream:{channel}"
        payload = json.dumps(data, default=str)
        entry_id = await r.xadd(
            stream_key,
            {"payload": payload},
            maxlen=maxlen,
            approximate=True,
        )
        return entry_id
    except Exception:
        return "0-0"


async def stream_read(channel: str, last_id: str = "$", block_ms: int = 15000) -> list[tuple[str, str]]:
    """Blocking read from a Redis Stream."""
    try:
        r = await get_redis()
        if r is None:
            return []
        stream_key = f"stream:{channel}"
        result = await r.xread({stream_key: last_id}, block=block_ms, count=10)
        entries = []
        if result:
            for _stream_name, messages in result:
                for msg_id, fields in messages:
                    entries.append((msg_id, fields.get("payload", "{}")))
        return entries
    except Exception:
        return []


async def stream_read_since(channel: str, last_id: str) -> list[tuple[str, str]]:
    """Non-blocking read of all entries after last_id."""
    try:
        r = await get_redis()
        if r is None:
            return []
        stream_key = f"stream:{channel}"
        result = await r.xread({stream_key: last_id}, count=100)
        entries = []
        if result:
            for _stream_name, messages in result:
                for msg_id, fields in messages:
                    entries.append((msg_id, fields.get("payload", "{}")))
        return entries
    except Exception:
        return []


async def publish_event(channel: str, event_type: str, data: dict):
    """Publish an event to a Redis Stream."""
    payload = {"event": event_type, "channel": channel, "data": data}
    await stream_add(channel, payload)


# ── Single-flight refresh ────────────────────────────────────────
async def acquire_refresh_lock(key: str, ttl: int = 30) -> bool:
    try:
        r = await get_redis()
        if r is None:
            return True  # No Redis = no lock = always proceed
        return await r.set(f"lock:{key}", "1", nx=True, ex=ttl)
    except Exception:
        return True


async def release_refresh_lock(key: str):
    try:
        r = await get_redis()
        if r is None:
            return
        await r.delete(f"lock:{key}")
    except Exception:
        pass
