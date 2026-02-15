"""Visa API proxy endpoints — FX rates, spend insights, payment volume."""

from __future__ import annotations

from fastapi import APIRouter, Query

from apps.api.services import visa as visa_service

router = APIRouter(prefix="/api/visa", tags=["visa"])


@router.get("/fx-rates")
async def fx_rates(source: str = Query("USD", min_length=3, max_length=3)):
    return await visa_service.get_fx_rates(source.upper())


@router.get("/spend-insights")
async def spend_insights(country: str = Query("US", min_length=2, max_length=2)):
    return await visa_service.get_spend_insights(country.upper())


@router.get("/payment-volume")
async def payment_volume():
    return await visa_service.get_payment_volume()


@router.get("/status")
async def visa_status():
    return {"configured": visa_service.is_configured()}
