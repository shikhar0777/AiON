"""Database models and connection setup."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, relationship

from apps.api.config import get_settings


class Base(DeclarativeBase):
    pass


# ── Models ───────────────────────────────────────────────────────
class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    provider = Column(String(50), nullable=False)
    source = Column(String(200), nullable=False)
    title = Column(Text, nullable=False)
    url = Column(Text, nullable=False)
    published_at = Column(DateTime(timezone=True))
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())
    country = Column(String(5), default="US")
    language = Column(String(20), default="en")
    category = Column(String(50), default="general")
    raw_snippet = Column(Text)
    image_url = Column(Text)
    cluster_id = Column(Integer, ForeignKey("clusters.cluster_id"), nullable=True)
    hash = Column(String(32), unique=True, nullable=False)
    embedding = Column(JSON, nullable=True)  # [float, ...] from text-embedding-3-small (256 dims)
    metadata_json = Column(JSON, default=dict)

    __table_args__ = (
        Index("ix_articles_hash", "hash"),
        Index("ix_articles_country_category", "country", "category"),
        Index("ix_articles_published", "published_at"),
        Index("ix_articles_cluster", "cluster_id"),
    )


class Cluster(Base):
    __tablename__ = "clusters"

    cluster_id = Column(Integer, primary_key=True, autoincrement=True)
    canonical_title = Column(Text, nullable=False)
    canonical_url = Column(Text)
    top_country = Column(String(5), default="US")
    top_category = Column(String(50), default="general")
    tags_json = Column(JSON, default=list)
    ai_summary = Column(Text)
    ai_key_points_json = Column(JSON, default=list)
    ai_entities_json = Column(JSON, default=dict)
    why_trending = Column(Text)
    score = Column(Float, default=0.0)
    metadata_json = Column(JSON, default=dict)  # sentiment, impact_score, ai_providers
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    articles = relationship("Article", backref="cluster", lazy="selectin")

    __table_args__ = (
        Index("ix_clusters_score", "score"),
        Index("ix_clusters_country_category", "top_country", "top_category"),
    )


class ClusterMember(Base):
    __tablename__ = "cluster_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cluster_id = Column(Integer, ForeignKey("clusters.cluster_id"), nullable=False)
    article_id = Column(Integer, ForeignKey("articles.id"), nullable=False)
    source = Column(String(200))

    __table_args__ = (
        Index("ix_cm_cluster", "cluster_id"),
        Index("ix_cm_article", "article_id"),
    )


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    password_hash = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    preferences = relationship("UserPreference", back_populates="user", uselist=False, lazy="selectin")
    notifications = relationship("Notification", back_populates="user", lazy="noload")


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    categories = Column(JSON, default=list)  # ["technology", "sports", ...]
    countries = Column(JSON, default=list)    # ["US", "NP", ...]
    notification_interval = Column(Integer, default=15)  # minutes
    last_notified_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="preferences")

    __table_args__ = (
        Index("ix_user_prefs_user", "user_id"),
    )


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    article_id = Column(Integer, ForeignKey("articles.id", ondelete="SET NULL"), nullable=True)
    cluster_id = Column(Integer, nullable=True)
    title = Column(Text, nullable=False)
    body = Column(Text, nullable=True)
    category = Column(String(50), nullable=True)
    country = Column(String(5), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")

    __table_args__ = (
        Index("ix_notifications_user", "user_id"),
        Index("ix_notifications_user_unread", "user_id", "is_read"),
    )


# ── Engine & Session ─────────────────────────────────────────────
_engine = None
_session_factory = None


def _ensure_async_url(url: str) -> str:
    """Convert postgresql:// to postgresql+asyncpg:// for async driver."""
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(
            _ensure_async_url(settings.database_url),
            echo=False,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
        )
    return _engine


def get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            get_engine(), class_=AsyncSession, expire_on_commit=False
        )
    return _session_factory


async def get_db() -> AsyncSession:
    factory = get_session_factory()
    async with factory() as session:
        yield session


async def init_db():
    """Create all tables."""
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    global _engine
    if _engine:
        await _engine.dispose()
        _engine = None
