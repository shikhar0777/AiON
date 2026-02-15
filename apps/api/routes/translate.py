"""Translation endpoint — translate news content to any language using AI."""

from fastapi import APIRouter

from apps.api.ai.router import get_ai_router
from packages.shared.schemas import TranslateRequest, TranslateResponse

router = APIRouter(prefix="/api", tags=["translate"])


@router.post("/translate")
async def translate(req: TranslateRequest) -> TranslateResponse:
    """Translate a batch of texts into the target language."""
    ai = get_ai_router()
    return await ai.translate_text(req.texts, req.target_language)
