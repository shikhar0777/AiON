"""HeyGen API client — list avatars and create photo avatars.

Uses Redis caching for avatar list. Falls back to demo data when API
key is missing or invalid (same pattern as visa.py).
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from apps.api.config import get_settings
from apps.api.redis_client import cache_get, cache_set

logger = logging.getLogger("aion.heygen")

HEYGEN_BASE = "https://api.heygen.com"
CACHE_TTL_AVATARS = 600  # 10 minutes

# ── Demo avatars (used when API key is missing/invalid) ──────

DEMO_AVATARS: list[dict[str, Any]] = [
    {"avatar_id": "demo_angela", "avatar_name": "Angela", "preview_image_url": "", "gender": "female"},
    {"avatar_id": "demo_josh", "avatar_name": "Josh", "preview_image_url": "", "gender": "male"},
    {"avatar_id": "demo_daisy", "avatar_name": "Daisy", "preview_image_url": "", "gender": "female"},
    {"avatar_id": "demo_tyler", "avatar_name": "Tyler", "preview_image_url": "", "gender": "male"},
    {"avatar_id": "demo_anna", "avatar_name": "Anna", "preview_image_url": "", "gender": "female"},
    {"avatar_id": "demo_bryan", "avatar_name": "Bryan", "preview_image_url": "", "gender": "male"},
    {"avatar_id": "demo_sophia", "avatar_name": "Sophia", "preview_image_url": "", "gender": "female"},
    {"avatar_id": "demo_edward", "avatar_name": "Edward", "preview_image_url": "", "gender": "male"},
    {"avatar_id": "demo_kayla", "avatar_name": "Kayla", "preview_image_url": "", "gender": "female"},
    {"avatar_id": "demo_eric", "avatar_name": "Eric", "preview_image_url": "", "gender": "male"},
    {"avatar_id": "demo_lily", "avatar_name": "Lily", "preview_image_url": "", "gender": "female"},
    {"avatar_id": "demo_marco", "avatar_name": "Marco", "preview_image_url": "", "gender": "male"},
]


def is_configured() -> bool:
    """Check if HeyGen API key is present."""
    return bool(get_settings().heygen_api_key)


def _headers() -> dict[str, str]:
    return {
        "X-Api-Key": get_settings().heygen_api_key,
        "Accept": "application/json",
    }


async def list_avatars() -> tuple[list[dict[str, Any]], bool]:
    """Return available HeyGen avatars (cached). Returns (avatars, demo)."""
    cache_key = "heygen:avatars"
    cached = await cache_get(cache_key)
    if cached:
        return cached.get("avatars", []), cached.get("demo", False)

    if not is_configured():
        return DEMO_AVATARS, True

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{HEYGEN_BASE}/v2/avatars",
                headers=_headers(),
            )
            resp.raise_for_status()
            data = resp.json()

        avatars = []
        for a in data.get("data", {}).get("avatars", []):
            avatars.append({
                "avatar_id": a.get("avatar_id", ""),
                "avatar_name": a.get("avatar_name", ""),
                "preview_image_url": a.get("preview_image_url", ""),
                "gender": a.get("gender", ""),
            })

        if avatars:
            await cache_set(cache_key, {"avatars": avatars, "demo": False}, CACHE_TTL_AVATARS)
            return avatars, False

    except Exception as e:
        logger.warning("HeyGen list_avatars failed, using demo: %s", e)

    await cache_set(cache_key, {"avatars": DEMO_AVATARS, "demo": True}, CACHE_TTL_AVATARS)
    return DEMO_AVATARS, True


async def upload_photo(image_bytes: bytes, filename: str) -> dict[str, Any]:
    """Upload a photo to HeyGen and create a photo avatar.

    Returns {avatar_id, preview_image_url} or {error}.
    """
    if not is_configured():
        return {"error": "HeyGen API key not configured — cannot create avatar in demo mode"}

    try:
        # Step 1: Upload the image asset
        async with httpx.AsyncClient(timeout=30.0) as client:
            upload_resp = await client.post(
                f"{HEYGEN_BASE}/v1/asset",
                headers={"X-Api-Key": get_settings().heygen_api_key},
                files={"file": (filename, image_bytes, "image/jpeg")},
            )
            upload_resp.raise_for_status()
            upload_data = upload_resp.json()

        image_key = upload_data.get("data", {}).get("id", "") or upload_data.get("data", {}).get("image_key", "")
        if not image_key:
            return {"error": "Failed to upload image — no asset ID returned"}

        # Step 2: Create a photo avatar group
        async with httpx.AsyncClient(timeout=30.0) as client:
            create_resp = await client.post(
                f"{HEYGEN_BASE}/v2/photo_avatar/avatar_group/create",
                headers={**_headers(), "Content-Type": "application/json"},
                json={"image_key": image_key},
            )
            create_resp.raise_for_status()
            create_data = create_resp.json()

        group_id = create_data.get("data", {}).get("group_id", "")

        # Invalidate avatar cache so new avatar appears
        from apps.api.redis_client import get_redis
        r = await get_redis()
        if r:
            await r.delete("cache:heygen:avatars")

        return {
            "avatar_id": group_id or image_key,
            "preview_image_url": upload_data.get("data", {}).get("url", ""),
        }

    except httpx.HTTPStatusError as e:
        body = e.response.json() if "application/json" in e.response.headers.get("content-type", "") else {}
        msg = body.get("error", {}).get("message", "") or body.get("message", str(e))
        logger.warning("HeyGen upload_photo HTTP error: %s", msg)
        return {"error": msg}
    except Exception as e:
        logger.warning("HeyGen upload_photo failed: %s", e)
        return {"error": str(e)}
