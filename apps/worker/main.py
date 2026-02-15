"""AiON Worker — background job runner with simple loop."""

from __future__ import annotations

import asyncio
import logging
import sys

from apps.api.config import get_settings
from apps.api.database import init_db, close_db, get_session_factory
from apps.api.redis_client import publish_event
from apps.api.services.clustering import cluster_articles
from apps.api.services.trending import update_trending_scores
from apps.worker.tasks.enrich import enrich_clusters
from apps.worker.tasks.ingest import ingest_news
from apps.worker.tasks.notify import generate_notifications

# ── Logging ──────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("worker")


async def run_task(name: str, coro):
    """Run a task with error handling."""
    try:
        result = await coro
        logger.info(f"Task {name} completed: {result}")
        return result
    except Exception as e:
        logger.error(f"Task {name} failed: {e}")
        return None


async def ingest_loop(interval: int):
    """Periodically ingest news from providers."""
    factory = get_session_factory()
    while True:
        try:
            async with factory() as db:
                await run_task("ingest", ingest_news(db))
        except Exception as e:
            logger.error(f"Ingest loop error: {e}")
        await asyncio.sleep(interval)


async def cluster_loop(interval: int):
    """Periodically cluster articles and update trending scores."""
    factory = get_session_factory()
    while True:
        try:
            async with factory() as db:
                await run_task("clustering", cluster_articles(db))
                await run_task("trending", update_trending_scores(db))

                # Publish feed update events for active channels
                await publish_event(
                    channel="*:*:trending",
                    event_type="feed_refresh",
                    data={"reason": "trending_update"},
                )
        except Exception as e:
            logger.error(f"Cluster loop error: {e}")
        await asyncio.sleep(interval)


async def enrich_loop(interval: int):
    """Periodically enrich clusters with AI summaries."""
    factory = get_session_factory()
    while True:
        try:
            async with factory() as db:
                await run_task("enrich", enrich_clusters(db))
        except Exception as e:
            logger.error(f"Enrich loop error: {e}")
        await asyncio.sleep(interval)


async def notify_loop(interval: int):
    """Periodically generate notifications for users based on their preferences."""
    factory = get_session_factory()
    while True:
        try:
            async with factory() as db:
                await run_task("notify", generate_notifications(db))
        except Exception as e:
            logger.error(f"Notify loop error: {e}")
        await asyncio.sleep(interval)


async def health_server():
    """Minimal HTTP health endpoint so Render free tier can run this as a web service."""
    import os
    from aiohttp import web

    async def health(_request):
        return web.Response(text="worker ok")

    app = web.Application()
    app.router.add_get("/health", health)
    port = int(os.environ.get("PORT", 9000))
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logger.info(f"Worker health server on :{port}")


async def main():
    logger.info("Starting AiON Worker...")
    settings = get_settings()

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    # Run all loops concurrently (+ health endpoint for Render free tier)
    try:
        await asyncio.gather(
            health_server(),
            ingest_loop(settings.ingest_interval_seconds),
            cluster_loop(settings.trending_interval_seconds),
            enrich_loop(settings.enrich_interval_seconds),
            notify_loop(60),
        )
    except KeyboardInterrupt:
        logger.info("Worker shutting down...")
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
