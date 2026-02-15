"""Chat endpoint — AI Q&A about news articles."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.ai.router import get_ai_router, CHAT_SYSTEM_PROMPT, GENERAL_CHAT_SYSTEM_PROMPT
from apps.api.database import get_db, Article, Cluster
from packages.shared.schemas import ChatRequest, ChatResponse, GeneralChatRequest

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
async def chat(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """Answer a question about a news article using AI."""
    # Fetch article
    result = await db.execute(select(Article).where(Article.id == req.article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Build cluster context if available
    cluster_context = ""
    if article.cluster_id:
        cl_result = await db.execute(
            select(Cluster).where(Cluster.cluster_id == article.cluster_id)
        )
        cluster = cl_result.scalar_one_or_none()
        if cluster:
            parts = []
            if cluster.ai_summary:
                parts.append(f"- AI Summary: {cluster.ai_summary}")
            if cluster.ai_key_points_json:
                points = "; ".join(cluster.ai_key_points_json[:5])
                parts.append(f"- Key Points: {points}")
            if cluster.ai_entities_json:
                entities = cluster.ai_entities_json
                entity_parts = []
                for etype, items in entities.items():
                    if items:
                        entity_parts.append(f"{etype}: {', '.join(items[:5])}")
                if entity_parts:
                    parts.append(f"- Entities: {'; '.join(entity_parts)}")
            # Related articles
            rel_result = await db.execute(
                select(Article.title, Article.source)
                .where(Article.cluster_id == article.cluster_id)
                .where(Article.id != article.id)
                .limit(5)
            )
            related = rel_result.all()
            if related:
                coverage = "; ".join(f"{r.source}: {r.title}" for r in related)
                parts.append(f"- Related coverage: {coverage}")

            if parts:
                cluster_context = "\nAdditional context:\n" + "\n".join(parts)

    # Build system prompt
    system_prompt = CHAT_SYSTEM_PROMPT.format(
        title=article.title,
        source=article.source,
        snippet=article.raw_snippet or "(no snippet available)",
        cluster_context=cluster_context,
    )

    # Build messages list from history + new question
    messages = [{"role": m.role, "content": m.content} for m in req.history[-8:]]
    messages.append({"role": "user", "content": req.question})

    ai = get_ai_router()
    return await ai.chat_answer(system_prompt, messages)


@router.post("/general-chat")
async def general_chat(req: GeneralChatRequest) -> ChatResponse:
    """Answer a general question about news and world events using AI."""
    messages = [{"role": m.role, "content": m.content} for m in req.history[-8:]]
    messages.append({"role": "user", "content": req.question})

    ai = get_ai_router()
    return await ai.chat_answer(GENERAL_CHAT_SYSTEM_PROMPT, messages)
