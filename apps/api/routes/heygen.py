"""HeyGen avatar endpoints — list and create avatars."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from apps.api.auth import get_current_user
from apps.api.database import User
from apps.api.services import heygen as heygen_service

router = APIRouter(prefix="/api/heygen", tags=["heygen"])

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


@router.get("/configured")
async def heygen_configured():
    return {"configured": heygen_service.is_configured()}


@router.get("/avatars")
async def list_avatars(user: User = Depends(get_current_user)):
    avatars, demo = await heygen_service.list_avatars()
    return {"avatars": avatars, "demo": demo}


@router.post("/avatars/upload")
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="Image must be under 10 MB")

    result = await heygen_service.upload_photo(image_bytes, file.filename or "avatar.jpg")
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])
    return result
