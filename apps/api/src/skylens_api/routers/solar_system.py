from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..jpl import JplClient
from ..models import SmallBodiesResponse

router = APIRouter(prefix="/api/v1", tags=["solar-system"])


def get_jpl(request: Request) -> JplClient:
    return request.app.state.jpl


@router.get("/solar-system", response_model=SmallBodiesResponse)
async def list_small_bodies(
    jpl: Annotated[JplClient, Depends(get_jpl)],
    ra: Annotated[float, Query(ge=0, lt=360, description="Field centre RA (deg, ICRS)")],
    dec: Annotated[float, Query(ge=-90, le=90, description="Field centre Dec (deg, ICRS)")],
    mjd: Annotated[float, Query(gt=50000, lt=70000, description="Observation time (MJD, UTC)")],
    size: Annotated[float, Query(gt=0, le=2, description="Field width (deg)")] = 1.0,
) -> SmallBodiesResponse:
    """Known asteroids and comets inside the field at the given time (JPL Small-Body Identification)."""
    try:
        bodies = await jpl.small_bodies(ra, dec, size, mjd)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"JPL request failed: {exc}") from exc
    return SmallBodiesResponse(ra=ra, dec=dec, size_deg=size, mjd=mjd, count=len(bodies), bodies=bodies)
