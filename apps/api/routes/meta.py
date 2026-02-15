"""Meta endpoints: countries, categories."""

from fastapi import APIRouter

from packages.shared.constants import CATEGORIES, CATEGORY_LABELS, COUNTRIES
from packages.shared.schemas import CategoryMeta, CountryMeta

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/countries")
async def list_countries() -> list[CountryMeta]:
    return [CountryMeta(code=code, name=name) for code, name in sorted(COUNTRIES.items())]


@router.get("/categories")
async def list_categories() -> list[CategoryMeta]:
    return [CategoryMeta(id=cat, label=CATEGORY_LABELS[cat]) for cat in CATEGORIES]
