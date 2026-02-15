"""Tests for trending score computation."""

import pytest
from apps.api.services.trending import compute_trending_score


class TestTrendingScore:
    def test_basic_score(self):
        score = compute_trending_score(
            unique_sources=3,
            newest_article_age_minutes=10,
            velocity=2,
        )
        assert score > 0
        assert isinstance(score, float)

    def test_more_sources_higher_score(self):
        score_few = compute_trending_score(unique_sources=1, newest_article_age_minutes=10, velocity=1)
        score_many = compute_trending_score(unique_sources=10, newest_article_age_minutes=10, velocity=1)
        assert score_many > score_few

    def test_newer_articles_higher_score(self):
        score_old = compute_trending_score(unique_sources=3, newest_article_age_minutes=1440, velocity=1)
        score_new = compute_trending_score(unique_sources=3, newest_article_age_minutes=5, velocity=1)
        assert score_new > score_old

    def test_higher_velocity_higher_score(self):
        score_slow = compute_trending_score(unique_sources=3, newest_article_age_minutes=10, velocity=0)
        score_fast = compute_trending_score(unique_sources=3, newest_article_age_minutes=10, velocity=10)
        assert score_fast > score_slow

    def test_zero_age_max_recency(self):
        score = compute_trending_score(unique_sources=1, newest_article_age_minutes=0, velocity=0)
        # Should have maximum recency boost
        assert score > 0

    def test_very_old_article_low_recency(self):
        score_old = compute_trending_score(unique_sources=1, newest_article_age_minutes=10000, velocity=0)
        score_new = compute_trending_score(unique_sources=1, newest_article_age_minutes=0, velocity=0)
        assert score_new > score_old

    def test_score_is_positive(self):
        score = compute_trending_score(unique_sources=0, newest_article_age_minutes=10000, velocity=0)
        assert score >= 0

    def test_viral_story_high_score(self):
        """A story with many sources, very recent, high velocity should score high."""
        score = compute_trending_score(
            unique_sources=20,
            newest_article_age_minutes=2,
            velocity=15,
        )
        assert score > 10
