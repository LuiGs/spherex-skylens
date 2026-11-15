from __future__ import annotations

import asyncio
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from ..models import SpectrumResponse
from ..spectrum import spectral_point, spread_observations
from .timelapse import TimelapseService, get_service

router = APIRouter(prefix="/api/v1/spectrum", tags=["spectrum"])

# About 3 SPHEREx pixels: enough to contain the position, small enough to download fast.
CUTOUT_DEG = 0.005


@router.get("", response_model=SpectrumResponse)
async def get_spectrum(
    service: Annotated[TimelapseService, Depends(get_service)],
    ra: Annotated[float, Query(ge=0, lt=360, description="Right ascension (deg, ICRS)")],
    dec: Annotated[float, Query(ge=-90, le=90, description="Declination (deg, ICRS)")],
    max_images: Annotated[int, Query(ge=6, le=150, description="Images to sample, spread over D1..D6")] = 60,
) -> SpectrumResponse:
    """0.75-5 µm spectrum at a position, sampling each SPHEREx image at the pixel containing it."""
    try:
        observations = await service.search(ra, dec, CUTOUT_DEG)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"IRSA request failed: {exc}") from exc
    chosen = spread_observations(observations, max_images)

    async def retrieve(url: str) -> bytes:
        async with service.semaphore:
            return await service.store.get(url)

    contents = await asyncio.gather(*(retrieve(item.cutout_url) for item in chosen), return_exceptions=True)
    if chosen and all(isinstance(content, Exception) for content in contents):
        raise HTTPException(status_code=502, detail="IRSA cutout requests failed")
    bad_flags = service.settings.timelapse_bad_flags
    samples = await asyncio.gather(
        *(
            asyncio.to_thread(spectral_point, content, observation, ra, dec, bad_flags)
            for observation, content in zip(chosen, contents, strict=True)
            if not isinstance(content, BaseException)
        )
    )
    points = sorted((item for item in samples if not isinstance(item, str)), key=lambda point: point.wavelength_um)
    reasons = [item for item in samples if isinstance(item, str)]
    return SpectrumResponse(
        ra=ra,
        dec=dec,
        n_images=len(chosen),
        n_available=len(observations),
        n_saturated=reasons.count("saturated"),
        n_flagged=reasons.count("flagged"),
        points=points,
    )
