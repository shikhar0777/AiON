"""Application configuration loaded from environment."""

from __future__ import annotations

import os
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # News providers
    newsapi_key: str = ""
    guardian_key: str = ""

    # AI providers
    openai_key: str = ""
    anthropic_key: str = ""
    perplexity_key: str = ""

    # Database
    database_url: str = "postgresql+asyncpg://pulse:pulse@localhost:5432/pulse"
    database_url_sync: str = "postgresql://pulse:pulse@localhost:5432/pulse"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT Auth
    jwt_secret: str = "aion-hackathon-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 72

    # HeyGen
    heygen_api_key: str = ""

    # Visa Developer API (mTLS)
    visa_user_id: str = ""
    visa_password: str = ""
    visa_cert_path: str = ""
    visa_key_path: str = ""
    visa_ca_cert_path: str = ""
    visa_base_url: str = "https://sandbox.api.visa.com"

    # Server
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000"

    # Worker intervals
    ingest_interval_seconds: int = 120
    enrich_interval_seconds: int = 30
    trending_interval_seconds: int = 60

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
