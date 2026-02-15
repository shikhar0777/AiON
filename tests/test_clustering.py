"""Tests for dedup and clustering logic."""

import pytest
from packages.shared.schemas import normalize_title
from apps.api.services.clustering import title_similarity


class TestTitleSimilarity:
    def test_identical_titles(self):
        sim = title_similarity("Breaking News Today", "Breaking News Today")
        assert sim == 1.0

    def test_very_similar_titles(self):
        sim = title_similarity(
            "Major earthquake strikes Pacific region",
            "Major earthquake hits the Pacific coast region",
        )
        assert sim >= 0.6

    def test_similar_titles_different_wording(self):
        sim = title_similarity(
            "Apple announces new AI features for iPhone",
            "Apple reveals artificial intelligence features for next iPhone",
        )
        assert sim >= 0.4

    def test_completely_different_titles(self):
        sim = title_similarity(
            "Major earthquake strikes Pacific region",
            "Apple announces new AI features for iPhone",
        )
        assert sim < 0.4

    def test_case_insensitive(self):
        sim = title_similarity("BREAKING NEWS", "breaking news")
        assert sim == 1.0

    def test_punctuation_ignored(self):
        sim = title_similarity(
            "Breaking: News Update!",
            "Breaking - News Update",
        )
        assert sim >= 0.8


class TestNormalization:
    def test_normalize_preserves_meaning(self):
        t1 = normalize_title("COVID-19 Cases Rise in Europe")
        t2 = normalize_title("covid-19 cases rise in europe")
        assert t1 == t2

    def test_normalize_strips_extra_whitespace(self):
        result = normalize_title("  too   many   spaces  ")
        assert "  " not in result
        assert result == "too many spaces"
