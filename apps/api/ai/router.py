"""AI Model Router — each provider has a dedicated role with fallback chains.

Provider Roles:
  - Claude (Anthropic): Cluster summarization — structured analysis, entity extraction, key points
  - OpenAI (GPT-4o-mini): Trending analysis — why trending, tags, sentiment
  - Perplexity (Sonar): Deep story explanation — web-augmented context, timeline, sources
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from typing import Optional

import httpx

from apps.api.config import get_settings
from apps.api.redis_client import get_redis
from packages.shared.schemas import AISummaryResponse, ChatResponse, ExplainResponse, TranslateResponse

logger = logging.getLogger(__name__)

# ── System Prompts ────────────────────────────────────────────────

SUMMARY_SYSTEM_PROMPT = """You are a concise news analyst. Given article titles and snippets from multiple sources about the same story, produce a JSON response with:
- "summary": A 1-2 sentence TL;DR of the story.
- "key_points": 3-6 bullet points (strings) capturing the essential facts.
- "entities": {"people": [...], "orgs": [...], "places": [...]} — extract named entities mentioned across sources.

Return ONLY valid JSON matching this exact schema. No markdown, no code fences."""

TRENDING_SYSTEM_PROMPT = """You are a news trend analyst. Given a cluster of articles about the same story, analyze WHY this story is trending and generate relevant metadata. Produce a JSON response with:
- "why_trending": A clear 1-2 sentence explanation of why this story is getting attention right now.
- "tags": An array of 3-5 short topic tags relevant to this story (e.g. ["AI", "regulation", "EU", "tech policy"]).
- "sentiment": One of "positive", "negative", "neutral", or "mixed".
- "impact_score": A number from 1-10 indicating the potential global impact of this story.

Return ONLY valid JSON matching this exact schema. No markdown, no code fences."""

CHAT_SYSTEM_PROMPT = """You are a helpful news assistant for AiON, an AI-powered news platform. You are answering questions about a specific news article.

Article context:
- Title: {title}
- Source: {source}
- Snippet: {snippet}
{cluster_context}

Answer the user's question about this article concisely and accurately. Use the article context provided. If you don't know something, say so rather than guessing. Keep answers focused and under 200 words unless more detail is needed."""

GENERAL_CHAT_SYSTEM_PROMPT = """You are AiON Assistant, an AI-powered news expert. You help users understand world events, explain news topics, compare perspectives, and answer general knowledge questions related to current affairs.

You are knowledgeable about:
- Global politics, economics, and geopolitics
- Technology, AI, science, and innovation
- Business, finance, and markets
- Health, environment, and climate
- Sports, entertainment, and culture
- History and context behind current events

Guidelines:
- Be concise and informative (under 250 words unless more detail is needed)
- Present balanced perspectives on controversial topics
- Cite specific events or facts when possible
- If you don't know something or it's beyond your knowledge cutoff, say so honestly
- Format responses with clear structure when explaining complex topics
- You can discuss any topic, but you specialize in news and current affairs"""

TRANSLATE_SYSTEM_PROMPT = """You are a professional news translator. Translate the following texts into {target_language}.

Rules:
- Translate EACH text faithfully, preserving the original meaning and tone.
- Keep proper nouns (names of people, organizations, places) in their commonly used form in the target language.
- Return a JSON object with a single key "translations" containing an array of translated strings, one per input text, in the same order.
- If a text is empty, return an empty string for it.

Return ONLY valid JSON. No markdown, no code fences."""

EXPLAIN_SYSTEM_PROMPT = """You are a news analyst providing deep context using web search. Given a news story, provide:
- "explanation": A clear 2-3 paragraph explanation of the story with background context and why it matters.
- "sources": Array of URLs or source references you can cite for further reading.
- "timeline": Array of {"time": "date/period", "event": "what happened"} for key events leading up to this story.
- "key_points": 3-5 important takeaways a reader should know.

Return ONLY valid JSON. No markdown, no code fences."""


class AIRouter:
    """Routes AI tasks to dedicated providers with fallback chains.

    - summarize_cluster() -> Claude (primary) -> OpenAI (fallback) -> deterministic
    - analyze_trending()  -> OpenAI (primary) -> Claude (fallback) -> deterministic
    - explain_story()     -> Perplexity (primary) -> OpenAI (fallback) -> Claude (fallback) -> deterministic
    """

    def __init__(self):
        self.settings = get_settings()

    # ── Public API ────────────────────────────────────────────────

    async def summarize_cluster(
        self, titles: list[str], snippets: list[str], sources: list[str]
    ) -> AISummaryResponse:
        """Summarize a cluster of articles.
        Primary: Claude (best at structured analysis and entity extraction).
        Fallback: OpenAI -> deterministic.
        """
        user_msg = self._build_summary_prompt(titles, snippets, sources)

        # Primary: Claude
        if self.settings.anthropic_key:
            try:
                result = await self._anthropic_chat(SUMMARY_SYSTEM_PROMPT, user_msg)
                parsed = self._parse_ai_json(result, "anthropic")
                logger.info("Cluster summary generated by Claude (Anthropic)")
                return AISummaryResponse(**parsed)
            except Exception as e:
                logger.warning(f"Claude summarize failed, trying OpenAI: {e}")

        # Fallback: OpenAI
        if self.settings.openai_key:
            try:
                result = await self._openai_chat(SUMMARY_SYSTEM_PROMPT, user_msg)
                parsed = self._parse_ai_json(result, "openai")
                logger.info("Cluster summary generated by OpenAI (fallback)")
                return AISummaryResponse(**parsed)
            except Exception as e:
                logger.warning(f"OpenAI summarize failed: {e}")

        # Deterministic fallback
        logger.info("Cluster summary generated by deterministic fallback")
        return self._fallback_summary(titles, snippets, sources)

    async def analyze_trending(
        self, titles: list[str], snippets: list[str], sources: list[str]
    ) -> dict:
        """Analyze why a cluster is trending and generate tags.
        Primary: OpenAI (best at trend analysis and structured classification).
        Fallback: Claude -> deterministic.
        Returns dict with: why_trending, tags, sentiment, impact_score.
        """
        user_msg = self._build_summary_prompt(titles, snippets, sources)

        # Primary: OpenAI
        if self.settings.openai_key:
            try:
                result = await self._openai_chat(TRENDING_SYSTEM_PROMPT, user_msg)
                parsed = self._parse_ai_json(result, "openai")
                logger.info("Trending analysis generated by OpenAI")
                return {
                    "why_trending": parsed.get("why_trending", ""),
                    "tags": parsed.get("tags", []),
                    "sentiment": parsed.get("sentiment", "neutral"),
                    "impact_score": parsed.get("impact_score", 5),
                    "ai_provider": "openai",
                }
            except Exception as e:
                logger.warning(f"OpenAI trending failed, trying Claude: {e}")

        # Fallback: Claude
        if self.settings.anthropic_key:
            try:
                result = await self._anthropic_chat(TRENDING_SYSTEM_PROMPT, user_msg)
                parsed = self._parse_ai_json(result, "anthropic")
                logger.info("Trending analysis generated by Claude (fallback)")
                return {
                    "why_trending": parsed.get("why_trending", ""),
                    "tags": parsed.get("tags", []),
                    "sentiment": parsed.get("sentiment", "neutral"),
                    "impact_score": parsed.get("impact_score", 5),
                    "ai_provider": "anthropic",
                }
            except Exception as e:
                logger.warning(f"Claude trending failed: {e}")

        # Deterministic fallback
        logger.info("Trending analysis generated by deterministic fallback")
        return {
            "why_trending": f"Covered by {len(set(sources))} sources" if sources else "",
            "tags": [],
            "sentiment": "neutral",
            "impact_score": 5,
            "ai_provider": "none",
        }

    async def explain_story(
        self, title: str, snippet: str, source: str
    ) -> ExplainResponse:
        """Get deep explanation for a story.
        Primary: Perplexity Sonar (has live web search for real-time context).
        Fallback: OpenAI -> Claude -> deterministic.
        """
        user_msg = (
            f"Explain this news story in depth with context and timeline:\n\n"
            f"Title: {title}\nSnippet: {snippet}\nSource: {source}"
        )

        # Primary: Perplexity (web search for real-time context)
        if self.settings.perplexity_key:
            try:
                result = await self._perplexity_chat(EXPLAIN_SYSTEM_PROMPT, user_msg)
                parsed = self._parse_ai_json(result, "perplexity")
                logger.info("Story explanation generated by Perplexity (Sonar)")
                resp = ExplainResponse(**parsed)
                resp.ai_provider = "perplexity"
                return resp
            except Exception as e:
                logger.warning(f"Perplexity explain failed, trying OpenAI: {e}")

        # Fallback: OpenAI
        if self.settings.openai_key:
            try:
                result = await self._openai_chat(EXPLAIN_SYSTEM_PROMPT, user_msg)
                parsed = self._parse_ai_json(result, "openai")
                logger.info("Story explanation generated by OpenAI (fallback)")
                resp = ExplainResponse(**parsed)
                resp.ai_provider = "openai"
                return resp
            except Exception as e:
                logger.warning(f"OpenAI explain failed, trying Claude: {e}")

        # Fallback: Claude
        if self.settings.anthropic_key:
            try:
                result = await self._anthropic_chat(EXPLAIN_SYSTEM_PROMPT, user_msg)
                parsed = self._parse_ai_json(result, "anthropic")
                logger.info("Story explanation generated by Claude (fallback)")
                resp = ExplainResponse(**parsed)
                resp.ai_provider = "anthropic"
                return resp
            except Exception as e:
                logger.warning(f"Claude explain failed: {e}")

        # Deterministic fallback
        logger.info("Story explanation generated by deterministic fallback")
        return ExplainResponse(
            explanation=f"{title}. {snippet or 'No additional context available.'}",
            sources=[],
            timeline=[],
            key_points=[snippet[:200] if snippet else title],
            ai_provider="none",
        )

    async def chat_answer(
        self, system_prompt: str, messages: list[dict]
    ) -> ChatResponse:
        """Answer a chat question about an article.
        Primary: Claude (best for multi-turn Q&A).
        Fallback: OpenAI -> error message.
        """
        # Primary: Claude
        if self.settings.anthropic_key:
            try:
                result = await self._anthropic_chat_multi(system_prompt, messages)
                logger.info("Chat answer generated by Claude (Anthropic)")
                return ChatResponse(answer=result, ai_provider="anthropic")
            except Exception as e:
                logger.warning(f"Claude chat failed, trying OpenAI: {e}")

        # Fallback: OpenAI
        if self.settings.openai_key:
            try:
                result = await self._openai_chat_multi(system_prompt, messages)
                logger.info("Chat answer generated by OpenAI (fallback)")
                return ChatResponse(answer=result, ai_provider="openai")
            except Exception as e:
                logger.warning(f"OpenAI chat failed: {e}")

        return ChatResponse(
            answer="Sorry, I couldn't process your question right now. Please try again later.",
            ai_provider="none",
        )

    # ── Translation (with Redis cache + parallel chunks) ─────────

    TRANSLATE_CACHE_TTL = 3600  # 1 hour

    @staticmethod
    def _translate_cache_key(text: str, lang: str) -> str:
        h = hashlib.md5(text.encode()).hexdigest()[:12]
        return f"tr:{lang}:{h}"

    async def _get_cached_translations(
        self, texts: list[str], target_language: str
    ) -> tuple[list[Optional[str]], list[int]]:
        """Check Redis for cached translations. Returns (results, uncached_indices)."""
        r = await get_redis()
        keys = [self._translate_cache_key(t, target_language) for t in texts]
        cached = await r.mget(keys)
        results: list[Optional[str]] = list(cached)
        uncached = [i for i, v in enumerate(results) if v is None and texts[i].strip()]
        return results, uncached

    async def _cache_translations(
        self, texts: list[str], translations: list[str], target_language: str
    ):
        """Cache individual translations in Redis."""
        r = await get_redis()
        pipe = r.pipeline()
        for text, translation in zip(texts, translations):
            if text.strip():
                key = self._translate_cache_key(text, target_language)
                pipe.set(key, translation, ex=self.TRANSLATE_CACHE_TTL)
        await pipe.execute()

    async def translate_text(
        self, texts: list[str], target_language: str
    ) -> TranslateResponse:
        """Translate texts with per-text Redis cache + parallel chunked AI calls.

        1. Check Redis cache for each text
        2. Send only uncached texts to AI (in parallel chunks of 20)
        3. Cache new translations, assemble full result
        """
        if not texts or not target_language:
            return TranslateResponse(
                translations=texts, target_language=target_language, ai_provider="none"
            )

        # Step 1: Check cache
        results, uncached_indices = await self._get_cached_translations(texts, target_language)
        uncached_texts = [texts[i] for i in uncached_indices]

        if not uncached_texts:
            # Everything was cached
            final = [r if r is not None else "" for r in results]
            logger.info(f"Translation cache hit: all {len(texts)} texts for {target_language}")
            return TranslateResponse(
                translations=final, target_language=target_language, ai_provider="cache"
            )

        logger.info(f"Translation: {len(texts) - len(uncached_texts)} cached, {len(uncached_texts)} to translate for {target_language}")

        # Step 2: Translate uncached texts in parallel chunks
        CHUNK_SIZE = 30
        chunks = [
            uncached_texts[i : i + CHUNK_SIZE]
            for i in range(0, len(uncached_texts), CHUNK_SIZE)
        ]

        # Run all chunks in parallel
        chunk_results = await asyncio.gather(
            *[self._translate_batch(chunk, target_language) for chunk in chunks],
            return_exceptions=True,
        )

        # Assemble translations from chunk results
        ai_translations: list[str] = []
        provider = "none"
        for i, result in enumerate(chunk_results):
            if isinstance(result, Exception):
                logger.warning(f"Chunk {i} translation failed: {result}")
                ai_translations.extend(chunks[i])  # use originals
            else:
                ai_translations.extend(result.translations)
                if result.ai_provider != "none":
                    provider = result.ai_provider

        # Step 3: Cache new translations
        if provider != "none":
            await self._cache_translations(uncached_texts, ai_translations, target_language)

        # Step 4: Merge cached + fresh translations
        ai_idx = 0
        final: list[str] = []
        for i, cached_val in enumerate(results):
            if cached_val is not None:
                final.append(cached_val)
            elif not texts[i].strip():
                final.append("")
            else:
                final.append(ai_translations[ai_idx] if ai_idx < len(ai_translations) else texts[i])
                ai_idx += 1

        return TranslateResponse(
            translations=final, target_language=target_language, ai_provider=provider
        )

    async def _translate_batch(
        self, texts: list[str], target_language: str
    ) -> TranslateResponse:
        """Translate a single batch (<=20 texts) using AI providers."""
        # Filter out empty strings, translate only non-empty
        non_empty = [(i, t) for i, t in enumerate(texts) if t.strip()]
        if not non_empty:
            return TranslateResponse(
                translations=[""] * len(texts), target_language=target_language, ai_provider="none"
            )

        non_empty_texts = [t for _, t in non_empty]
        system_prompt = TRANSLATE_SYSTEM_PROMPT.format(target_language=target_language)
        numbered = "\n".join(f"[{i+1}] {t}" for i, t in enumerate(non_empty_texts))
        user_msg = f"Translate these {len(non_empty_texts)} texts into {target_language}:\n\n{numbered}"

        translated = await self._try_translate_providers(system_prompt, user_msg, len(non_empty_texts), target_language)
        if translated is None:
            return TranslateResponse(
                translations=texts, target_language=target_language, ai_provider="none"
            )

        ai_translations, provider = translated

        # Map back to original positions (fill empties with "")
        result = [""] * len(texts)
        for idx, (orig_i, _) in enumerate(non_empty):
            result[orig_i] = ai_translations[idx] if idx < len(ai_translations) else texts[orig_i]

        return TranslateResponse(
            translations=result, target_language=target_language, ai_provider=provider
        )

    async def _try_translate_providers(
        self, system_prompt: str, user_msg: str, expected_count: int, target_language: str
    ) -> Optional[tuple[list[str], str]]:
        """Try each AI provider for translation. Returns (translations, provider) or None."""
        # Primary: Claude
        if self.settings.anthropic_key:
            try:
                result = await self._anthropic_chat(system_prompt, user_msg, max_tokens=4096)
                parsed = self._parse_ai_json(result, "anthropic")
                translations = parsed.get("translations", [])
                if len(translations) == expected_count:
                    logger.info(f"Translation to {target_language} by Claude ({expected_count} texts)")
                    return translations, "anthropic"
                logger.warning(f"Claude: expected {expected_count}, got {len(translations)}")
            except Exception as e:
                logger.warning(f"Claude translate failed: {e}")

        # Fallback: OpenAI
        if self.settings.openai_key:
            try:
                result = await self._openai_chat(system_prompt, user_msg, max_tokens=4096)
                parsed = self._parse_ai_json(result, "openai")
                translations = parsed.get("translations", [])
                if len(translations) == expected_count:
                    logger.info(f"Translation to {target_language} by OpenAI ({expected_count} texts)")
                    return translations, "openai"
                logger.warning(f"OpenAI: expected {expected_count}, got {len(translations)}")
            except Exception as e:
                logger.warning(f"OpenAI translate failed: {e}")

        # Fallback: Perplexity
        if self.settings.perplexity_key:
            try:
                result = await self._perplexity_chat(system_prompt, user_msg)
                parsed = self._parse_ai_json(result, "perplexity")
                translations = parsed.get("translations", [])
                if len(translations) == expected_count:
                    logger.info(f"Translation to {target_language} by Perplexity ({expected_count} texts)")
                    return translations, "perplexity"
            except Exception as e:
                logger.warning(f"Perplexity translate failed: {e}")

        logger.warning(f"All translation providers failed for {target_language}")
        return None

    # ── Multi-turn helpers ─────────────────────────────────────────

    async def _anthropic_chat_multi(self, system: str, messages: list[dict]) -> str:
        headers = {
            "x-api-key": self.settings.anthropic_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        body = {
            "model": "claude-sonnet-4-5-20250929",
            "max_tokens": 1024,
            "system": system,
            "messages": messages,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=body,
            )
            resp.raise_for_status()
            return resp.json()["content"][0]["text"]

    async def _openai_chat_multi(self, system: str, messages: list[dict]) -> str:
        headers = {
            "Authorization": f"Bearer {self.settings.openai_key}",
            "Content-Type": "application/json",
        }
        oai_messages = [{"role": "system", "content": system}] + messages
        body = {
            "model": "gpt-4o-mini",
            "messages": oai_messages,
            "temperature": 0.3,
            "max_tokens": 1024,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=body,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    # ── Prompt builders ───────────────────────────────────────────

    def _build_summary_prompt(
        self, titles: list[str], snippets: list[str], sources: list[str]
    ) -> str:
        parts = []
        for i, (t, s, src) in enumerate(zip(titles, snippets, sources)):
            parts.append(f"[{i+1}] {src}: {t}\n   {s or '(no snippet)'}")
        return "Analyze this news cluster:\n\n" + "\n\n".join(parts)

    def _parse_ai_json(self, text: str, model_type: str) -> dict:
        """Parse JSON from AI response, handling common formatting issues."""
        text = text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(lines)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse JSON from {model_type}: {text[:200]}")
            raise

    # ── Anthropic (Claude) ────────────────────────────────────────

    async def _anthropic_chat(self, system: str, user: str, max_tokens: int = 1024) -> str:
        headers = {
            "x-api-key": self.settings.anthropic_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        body = {
            "model": "claude-sonnet-4-5-20250929",
            "max_tokens": max_tokens,
            "system": system + "\n\nReturn ONLY valid JSON.",
            "messages": [{"role": "user", "content": user}],
        }
        timeout = 30 if max_tokens <= 1024 else 60
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=body,
            )
            resp.raise_for_status()
            return resp.json()["content"][0]["text"]

    # ── OpenAI (GPT-4o-mini) ─────────────────────────────────────

    async def _openai_chat(self, system: str, user: str, max_tokens: int = 1024) -> str:
        headers = {
            "Authorization": f"Bearer {self.settings.openai_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.3,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
        }
        timeout = 30 if max_tokens <= 1024 else 60
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=body,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    # ── Perplexity (Sonar) ────────────────────────────────────────

    async def _perplexity_chat(self, system: str, user: str) -> str:
        headers = {
            "Authorization": f"Bearer {self.settings.perplexity_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": "sonar",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.3,
        }
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers=headers,
                json=body,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    # ── Deterministic Fallback ────────────────────────────────────

    def _fallback_summary(
        self, titles: list[str], snippets: list[str], sources: list[str]
    ) -> AISummaryResponse:
        """Deterministic fallback when no AI provider is available."""
        best_title = titles[0] if titles else "News story"
        best_snippet = next((s for s in snippets if s), "")

        return AISummaryResponse(
            summary=f"{best_title}. {best_snippet[:150]}" if best_snippet else best_title,
            key_points=[t for t in titles[:4]],
            entities={"people": [], "orgs": [], "places": []},
            why_trending=f"Covered by {len(set(sources))} sources" if sources else "",
        )


# Singleton
_ai_router: Optional[AIRouter] = None


def get_ai_router() -> AIRouter:
    global _ai_router
    if _ai_router is None:
        _ai_router = AIRouter()
    return _ai_router
