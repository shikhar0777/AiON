"""AiON API — FastAPI application entry point."""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.config import get_settings
from apps.api.database import init_db, close_db
from apps.api.middleware.caching import ETagMiddleware
from apps.api.redis_client import close_redis
from apps.api.routes import auth, chat, feed, health, heygen, meta, notifications, preferences, search, story, stream, translate, visa

# ── Logging ──────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("aion")


# ── Lifespan ─────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AiON API...")
    await init_db()
    logger.info("Database initialized")
    yield
    await close_db()
    await close_redis()
    logger.info("AiON API shut down")


# ── App ──────────────────────────────────────────────────────────
app = FastAPI(
    title="AiON API",
    description="AI-powered global news discovery platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Middleware (order matters: CORS first, then ETag)
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(ETagMiddleware)

# Routes
app.include_router(health.router)
app.include_router(meta.router)
app.include_router(feed.router)
app.include_router(story.router)
app.include_router(stream.router)
app.include_router(chat.router)
app.include_router(translate.router)
app.include_router(auth.router)
app.include_router(preferences.router)
app.include_router(notifications.router)
app.include_router(search.router)
app.include_router(visa.router)
app.include_router(heygen.router)


@app.get("/")
async def root():
    return {
        "name": "AiON API",
        "version": "1.0.0",
        "docs": "/docs",
    }
