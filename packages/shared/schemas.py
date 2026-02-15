"""Shared Pydantic schemas for AiON."""

from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ── Helpers ──────────────────────────────────────────────────────────
def normalize_title(title: str) -> str:
    """Normalize a title for dedup comparison."""
    t = unicodedata.normalize("NFKD", title.lower().strip())
    t = re.sub(r"[^\w\s]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def make_article_hash(title: str, source: str) -> str:
    """Create a dedup hash from normalized title + source."""
    norm = normalize_title(title)
    return hashlib.sha256(f"{norm}|{source}".encode()).hexdigest()[:32]


# ── Article ──────────────────────────────────────────────────────────
class ArticleBase(BaseModel):
    provider: str
    source: str
    title: str
    url: str
    published_at: Optional[datetime] = None
    country: str = "US"
    language: str = "en"
    raw_snippet: Optional[str] = None
    image_url: Optional[str] = None
    category: str = "general"


class ArticleCreate(ArticleBase):
    hash: str = ""

    def model_post_init(self, __context):
        if not self.hash:
            self.hash = make_article_hash(self.title, self.source)


class ArticleRead(ArticleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cluster_id: Optional[int] = None
    hash: str
    fetched_at: datetime
    metadata_json: Optional[dict] = None


# ── Cluster ──────────────────────────────────────────────────────────
class ClusterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cluster_id: int
    canonical_title: str
    canonical_url: Optional[str] = None
    top_country: str = "US"
    top_category: str = "general"
    tags_json: Optional[list[str]] = None
    ai_summary: Optional[str] = None
    ai_key_points_json: Optional[list[str]] = None
    ai_entities_json: Optional[dict] = None
    why_trending: Optional[str] = None
    score: float = 0.0
    last_updated: datetime
    article_count: int = 0
    sources: list[str] = []
    top_image_url: Optional[str] = None


# ── Feed ──────────────────────────────────────────────────────────
class FeedItem(BaseModel):
    id: int
    title: str
    source: str
    url: str
    published_at: Optional[datetime] = None
    country: str
    category: str
    image_url: Optional[str] = None
    cluster_id: Optional[int] = None
    cluster_size: int = 1
    score: float = 0.0
    ai_summary: Optional[str] = None
    why_trending: Optional[str] = None


class FeedResponse(BaseModel):
    items: list[FeedItem]
    total: int
    cursor: Optional[str] = None
    updated_at: datetime
    sources_used: list[str] = []
    cached: bool = False


# ── Story Intelligence ───────────────────────────────────────────
class StoryIntelligence(BaseModel):
    article: ArticleRead
    cluster: Optional[ClusterRead] = None
    ai_summary: Optional[str] = None
    key_points: list[str] = []
    entities: Optional[dict] = None
    why_trending: Optional[str] = None
    related_articles: list[ArticleRead] = []
    source_angles: list[dict] = []  # [{source, headline, angle}]
    timeline: list[dict] = []       # [{time, event}]


# ── AI Schemas ───────────────────────────────────────────────────
class AISummaryRequest(BaseModel):
    titles: list[str]
    snippets: list[str]
    sources: list[str]


class AISummaryResponse(BaseModel):
    summary: str
    key_points: list[str] = Field(default_factory=list)
    entities: dict = Field(default_factory=dict)  # {people:[], orgs:[], places:[]}
    why_trending: str = ""

    @field_validator("key_points", mode="before")
    @classmethod
    def limit_key_points(cls, v):
        if isinstance(v, list):
            return v[:6]
        return v


class ExplainResponse(BaseModel):
    explanation: str
    sources: list[str] = []
    timeline: list[dict] = []  # [{time, event}]
    key_points: list[str] = []
    ai_provider: str = ""  # which AI provider generated this


# ── Chat ─────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    article_id: int
    question: str
    history: list[ChatMessage] = Field(default_factory=list)


class GeneralChatRequest(BaseModel):
    question: str
    history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    answer: str
    ai_provider: str = ""


# ── Translation ──────────────────────────────────────────────────
class TranslateRequest(BaseModel):
    texts: list[str]
    target_language: str  # e.g. "Nepali", "Spanish", "French"


class TranslateResponse(BaseModel):
    translations: list[str]
    target_language: str
    ai_provider: str = ""


# ── SSE Events ───────────────────────────────────────────────────
class SSEEvent(BaseModel):
    event: str  # "feed_update", "cluster_update", "new_article"
    channel: str  # "US:technology:trending"
    data: dict


# ── Meta ─────────────────────────────────────────────────────────
class CountryMeta(BaseModel):
    code: str
    name: str


class CategoryMeta(BaseModel):
    id: str
    label: str


# ── Provider Health ──────────────────────────────────────────────
class ProviderStatus(BaseModel):
    name: str
    status: str  # "healthy", "degraded", "circuit_open"
    last_success: Optional[datetime] = None
    last_error: Optional[str] = None
    cooldown_until: Optional[datetime] = None
    calls_last_hour: int = 0


# ── Auth ────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: str
    display_name: str
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: str
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    display_name: str
    created_at: datetime


class AuthResponse(BaseModel):
    token: str
    user: UserRead


# ── User Preferences ────────────────────────────────────────────
class PreferencesRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    categories: list[str] = []
    countries: list[str] = []
    notification_interval: int = 15


class PreferencesUpdate(BaseModel):
    categories: Optional[list[str]] = None
    countries: Optional[list[str]] = None
    notification_interval: Optional[int] = None


# ── Notifications ───────────────────────────────────────────────
class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    article_id: Optional[int] = None
    cluster_id: Optional[int] = None
    title: str
    body: Optional[str] = None
    category: Optional[str] = None
    country: Optional[str] = None
    is_read: bool = False
    created_at: datetime


class NotificationsResponse(BaseModel):
    items: list[NotificationRead]
    unread_count: int
