"""SSE streaming endpoint using Redis Streams for durable, resumable delivery."""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from apps.api.redis_client import stream_read, stream_read_since

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["stream"])


@router.get("/stream")
async def stream(
    request: Request,
    country: str = Query("US", max_length=5),
    category: str = Query("general", max_length=50),
    mode: str = Query("trending", pattern="^(trending|latest)$"),
):
    """SSE endpoint backed by Redis Streams.

    Supports lossless reconnection via the standard Last-Event-ID header.
    The browser's native EventSource sends this header automatically on
    reconnect when the server includes `id:` in each event.

    Stream key: stream:{COUNTRY}:{category}:{mode}
    """
    channel = f"{country.upper()}:{category}:{mode}"

    # Read Last-Event-ID from headers (sent automatically by EventSource on reconnect)
    last_event_id = request.headers.get("last-event-id", "$")

    async def event_generator():
        current_id = last_event_id

        # Replay missed events if resuming from a previous connection
        if current_id != "$":
            try:
                missed = await stream_read_since(channel, current_id)
                for entry_id, payload in missed:
                    yield f"id: {entry_id}\nevent: update\ndata: {payload}\n\n"
                    current_id = entry_id
                logger.info(f"SSE resume: replayed {len(missed)} events for {channel} from {last_event_id}")
            except Exception as e:
                logger.warning(f"SSE resume replay failed: {e}")
                # Fall back to live stream
                current_id = "$"

        # Send initial connection event
        yield f"event: connected\ndata: {json.dumps({'channel': channel})}\n\n"

        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break

            try:
                entries = await stream_read(channel, current_id, block_ms=15000)

                if entries:
                    for entry_id, payload in entries:
                        yield f"id: {entry_id}\nevent: update\ndata: {payload}\n\n"
                        current_id = entry_id
                else:
                    # No new data — send heartbeat
                    yield f"event: heartbeat\ndata: {json.dumps({'ts': 'ping'})}\n\n"

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"SSE stream error: {e}")
                yield f"event: heartbeat\ndata: {json.dumps({'ts': 'ping'})}\n\n"
                await asyncio.sleep(5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
