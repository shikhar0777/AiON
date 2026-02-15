"""Tests for schema validation and dedup helpers."""

import pytest
from packages.shared.schemas import (
    ArticleCreate,
    AISummaryResponse,
    ExplainResponse,
    FeedItem,
    FeedResponse,
    make_article_hash,
    normalize_title,
)
from datetime import datetime, timezone


class TestNormalizeTitle:
    def test_basic_normalization(self):
        assert normalize_title("Hello World!") == "hello world"

    def test_removes_punctuation(self):
        result = normalize_title("Breaking: News — Update!")
        assert "breaking" in result
        assert "news" in result
        assert "update" in result
        assert ":" not in result
        assert "!" not in result

    def test_collapses_whitespace(self):
        result = normalize_title("  lots   of   spaces  ")
        assert "  " not in result

    def test_unicode_normalization(self):
        result = normalize_title("café résumé")
        assert isinstance(result, str)


class TestArticleHash:
    def test_same_title_same_source(self):
        h1 = make_article_hash("Breaking News Today", "CNN")
        h2 = make_article_hash("Breaking News Today", "CNN")
        assert h1 == h2

    def test_different_source_different_hash(self):
        h1 = make_article_hash("Breaking News Today", "CNN")
        h2 = make_article_hash("Breaking News Today", "BBC")
        assert h1 != h2

    def test_case_insensitive(self):
        h1 = make_article_hash("Breaking News", "CNN")
        h2 = make_article_hash("breaking news", "CNN")
        assert h1 == h2

    def test_hash_length(self):
        h = make_article_hash("Test", "Source")
        assert len(h) == 32


class TestArticleCreate:
    def test_auto_hash(self):
        article = ArticleCreate(
            provider="newsapi",
            source="CNN",
            title="Test Article",
            url="https://example.com",
        )
        assert article.hash != ""
        assert len(article.hash) == 32

    def test_default_values(self):
        article = ArticleCreate(
            provider="test",
            source="Test",
            title="Test",
            url="https://example.com",
        )
        assert article.country == "US"
        assert article.language == "en"
        assert article.category == "general"


class TestAISummaryResponse:
    def test_valid_response(self):
        resp = AISummaryResponse(
            summary="Test summary",
            key_points=["Point 1", "Point 2"],
            entities={"people": ["John"], "orgs": ["ACME"]},
            why_trending="Covered by many sources",
        )
        assert resp.summary == "Test summary"
        assert len(resp.key_points) == 2

    def test_key_points_limit(self):
        resp = AISummaryResponse(
            summary="Test",
            key_points=["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"],
            entities={},
            why_trending="",
        )
        assert len(resp.key_points) == 6

    def test_empty_defaults(self):
        resp = AISummaryResponse(summary="Test")
        assert resp.key_points == []
        assert resp.entities == {}
        assert resp.why_trending == ""


class TestExplainResponse:
    def test_valid_response(self):
        resp = ExplainResponse(
            explanation="Deep analysis here",
            sources=["https://example.com"],
            timeline=[{"time": "Jan 2024", "event": "Something happened"}],
            key_points=["Key takeaway"],
        )
        assert resp.explanation == "Deep analysis here"

    def test_empty_defaults(self):
        resp = ExplainResponse(explanation="Test")
        assert resp.sources == []
        assert resp.timeline == []


class TestFeedResponse:
    def test_valid_response(self):
        resp = FeedResponse(
            items=[
                FeedItem(
                    id=1,
                    title="Test",
                    source="CNN",
                    url="https://example.com",
                    published_at=None,
                    country="US",
                    category="general",
                    cluster_size=1,
                    score=5.0,
                )
            ],
            total=1,
            cursor=None,
            updated_at=datetime.now(timezone.utc),
            sources_used=["newsapi"],
            cached=False,
        )
        assert resp.total == 1
        assert len(resp.items) == 1
