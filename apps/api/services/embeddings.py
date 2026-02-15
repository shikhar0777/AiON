"""Embedding generation and similarity computation for article clustering."""

from __future__ import annotations

import logging
import math
from typing import Optional

import httpx

from apps.api.config import get_settings
from packages.shared.constants import EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_BATCH_SIZE

logger = logging.getLogger(__name__)


async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts using OpenAI's embedding API.

    Returns list of embedding vectors in the same order as input texts.
    Returns empty list if OpenAI key is not configured.
    """
    settings = get_settings()
    if not settings.openai_key:
        return []

    if not texts:
        return []

    all_embeddings: list[Optional[list[float]]] = [None] * len(texts)

    # Process in batches
    for i in range(0, len(texts), EMBEDDING_BATCH_SIZE):
        batch = texts[i : i + EMBEDDING_BATCH_SIZE]
        headers = {
            "Authorization": f"Bearer {settings.openai_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": EMBEDDING_MODEL,
            "input": batch,
            "dimensions": EMBEDDING_DIMENSIONS,
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers=headers,
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()["data"]
            # Sort by index to maintain order
            for item in sorted(data, key=lambda x: x["index"]):
                all_embeddings[i + item["index"]] = item["embedding"]

    return [e for e in all_embeddings if e is not None]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors. Pure Python, no numpy."""
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def compute_centroid(embeddings: list[list[float]]) -> list[float]:
    """Compute the centroid (element-wise average) of a list of embeddings."""
    if not embeddings:
        return []
    dim = len(embeddings[0])
    n = len(embeddings)
    centroid = [0.0] * dim
    for emb in embeddings:
        for i, v in enumerate(emb):
            centroid[i] += v
    return [c / n for c in centroid]
