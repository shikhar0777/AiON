"""ETag + Cache-Control middleware for API responses."""

from __future__ import annotations

import hashlib

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Per-path cache control policies
CACHE_POLICIES = {
    "/api/feed": "public, max-age=60, stale-while-revalidate=120",
    "/api/story/": "public, max-age=120, stale-while-revalidate=300",
    "/api/cluster/": "public, max-age=90, stale-while-revalidate=180",
    "/api/explain": "public, max-age=300, stale-while-revalidate=600",
    "/api/countries": "public, max-age=3600",
    "/api/categories": "public, max-age=3600",
}

# Paths to skip (streaming, health checks)
SKIP_PATHS = {"/api/stream", "/api/health"}


class ETagMiddleware(BaseHTTPMiddleware):
    """Adds ETag and Cache-Control headers to GET responses.

    - Computes ETag from MD5 of response body
    - Returns 304 Not Modified when If-None-Match matches
    - Sets Cache-Control with stale-while-revalidate per endpoint
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Only process GET requests with 200 status
        if request.method != "GET" or response.status_code != 200:
            return response

        # Skip streaming and health endpoints
        path = request.url.path
        if path in SKIP_PATHS:
            return response

        # Skip if response doesn't have a body iterator (shouldn't happen but safety check)
        if not hasattr(response, "body_iterator"):
            return response

        # Read response body
        body = b""
        async for chunk in response.body_iterator:
            if isinstance(chunk, bytes):
                body += chunk
            else:
                body += chunk.encode("utf-8")

        # Compute ETag
        etag = f'"{hashlib.md5(body).hexdigest()}"'

        # Check If-None-Match — return 304 if ETag matches
        if_none_match = request.headers.get("if-none-match", "")
        if if_none_match == etag:
            return Response(
                status_code=304,
                headers={"ETag": etag, "Cache-Control": "no-cache"},
            )

        # Find matching cache policy by path prefix
        cache_control = "no-cache"
        for prefix, policy in CACHE_POLICIES.items():
            if path.startswith(prefix):
                cache_control = policy
                break

        # Build response with caching headers
        headers = dict(response.headers)
        headers["ETag"] = etag
        headers["Cache-Control"] = cache_control
        headers["Vary"] = "Accept-Encoding"

        return Response(
            content=body,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type,
        )
