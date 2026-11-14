from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..irsa import IrsaClient
from ..models import ObservationsResponse

router = APIRouter(prefix="/api/v1", tags=["observations"])


def get_irsa(request: Request) -> IrsaClient:
    return request.app.state.irsa


@router.get("/observations", response_model=ObservationsResponse)
async def list_observations(
    irsa: Annotated[IrsaClient, Depends(get_irsa)],
    ra: Annotated[float, Query(ge=0, lt=360, description="Right ascension (deg, ICRS)")],
    dec: Annotated[float, Query(ge=-90, le=90, description="Declination (deg, ICRS)")],
    size: Annotated[float, Query(gt=0, le=1, description="Cutout size (deg)")] = 0.05,
    detector: Annotated[int | None, Query(ge=1, le=6)] = None,
) -> ObservationsResponse:
    """SPHEREx spectral images covering (ra, dec), sorted by time, with ready-to-use cutout URLs."""
    try:
        observations = await irsa.search_spectral_images(ra, dec, size)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"IRSA request failed: {exc}") from exc
    if detector is not None:
        observations = [o for o in observations if o.detector == detector]
    return ObservationsResponse(ra=ra, dec=dec, size_deg=size, count=len(observations), observations=observations)
