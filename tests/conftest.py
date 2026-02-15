"""Shared test fixtures."""

import pytest


@pytest.fixture
def sample_articles():
    """Sample article data for testing."""
    from packages.shared.schemas import ArticleCreate

    return [
        ArticleCreate(
            provider="newsapi",
            source="CNN",
            title="Major earthquake strikes Pacific region",
            url="https://example.com/1",
            country="US",
            category="general",
            raw_snippet="A 7.2 magnitude earthquake hit the Pacific coast today.",
        ),
        ArticleCreate(
            provider="guardian",
            source="The Guardian",
            title="Major earthquake hits the Pacific coast region",
            url="https://example.com/2",
            country="US",
            category="general",
            raw_snippet="A powerful earthquake struck the Pacific region.",
        ),
        ArticleCreate(
            provider="gdelt",
            source="Reuters",
            title="Pacific earthquake: Tsunami warning issued after 7.2 quake",
            url="https://example.com/3",
            country="US",
            category="general",
            raw_snippet="Authorities issued a tsunami warning following the earthquake.",
        ),
        ArticleCreate(
            provider="newsapi",
            source="TechCrunch",
            title="Apple announces new AI features for iPhone",
            url="https://example.com/4",
            country="US",
            category="technology",
            raw_snippet="Apple unveiled new artificial intelligence capabilities.",
        ),
        ArticleCreate(
            provider="guardian",
            source="The Guardian",
            title="Apple reveals artificial intelligence features for next iPhone",
            url="https://example.com/5",
            country="US",
            category="technology",
            raw_snippet="The tech giant showed off new AI integration.",
        ),
    ]
