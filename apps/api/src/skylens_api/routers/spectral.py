import asyncio
import re
from typing import Annotated, Literal

import httpx
from astropy import units as u
from astropy_healpix import HEALPix
from fastapi import APIRouter, HTTPException, Path, Query, Request, Response
from fastapi.responses import RedirectResponse

from ..spectral import WAVELENGTHS

router = APIRouter(prefix="/api/v1/spectral/hips", tags=["spectral"])


@router.get("/{mode}/{low}/{high}/{asset:path}")
async def spectral_hips(
    request: Request,
    mode: Literal["mono", "color"],
    low: Annotated[int, Path(ge=0, le=101)],
    high: Annotated[int, Path(ge=0, le=101)],
    asset: str,
    ra: Annotated[float | None, Query(ge=0, lt=360)] = None,
    dec: Annotated[float | None, Query(ge=-90, le=90)] = None,
    order: Annotated[int, Query(ge=0, le=5)] = 2,
) -> Response:
    if low > high:
        raise HTTPException(422, "Minimum channel must not exceed maximum channel")
    single_channel = mode == "mono" or low == high
    if asset == "prepare":
        if ra is None or dec is None:
            raise HTTPException(422, "Sky position required")
        if single_channel:
            return Response('{"ready":true}', media_type="application/json", headers={"Cache-Control": "no-store"})

        async def warm():
            for level in sorted({order, min(order, 2)}):
                pixel = int(HEALPix(nside=2**level, order="nested").lonlat_to_healpix(ra * u.deg, dec * u.deg))
                tile = f"Norder{level}/Dir{pixel // 10000 * 10000}/Npix{pixel}.png"
                await request.app.state.spectral.tile(tile, low, high, monochrome=mode == "mono")

        job = asyncio.create_task(warm())
        try:
            while not job.done():
                await asyncio.wait({job}, timeout=0.15)
                if await request.is_disconnected():
                    job.cancel()
                    await asyncio.gather(job, return_exceptions=True)
                    return Response(status_code=499)
            await job
        except httpx.HTTPError as exc:
            raise HTTPException(502, "Unable to prepare spectral images") from exc
        finally:
            if not job.done():
                job.cancel()
        return Response('{"ready":true}', media_type="application/json", headers={"Cache-Control": "no-store"})
    if asset == "properties":
        properties = {
            "creator_did": f"ivo://skylens/spherex/{mode}/{low}/{high}",
            "obs_title": f"SPHEREx {WAVELENGTHS[low]}–{WAVELENGTHS[high]} um (display composite)",
            "hips_version": "1.4",
            "hips_frame": "equatorial",
            "hips_order": "5",
            "hips_order_min": "0",
            "hips_tile_width": "512",
            "hips_tile_format": "png",
            "dataproduct_type": "image",
            "hips_pixel_cut": "0 255",
            "hips_pixel_function": "linear",
        }
        return Response("\n".join(f"{k} = {v}" for k, v in properties.items()), media_type="text/plain")
    match = re.fullmatch(r"Norder([0-5])/Dir(\d+)/Npix(\d+)\.png", asset)
    if not match:
        raise HTTPException(404, "Asset not available")
    order, directory, pixel = map(int, match.groups())
    if pixel >= 12 * 4**order or directory != pixel // 10000 * 10000:
        raise HTTPException(404, "Invalid HiPS tile")
    if single_channel:
        # A single channel needs no compositing: send the browser straight to IRSA's tile for that frame.
        return RedirectResponse(
            request.app.state.spectral.frame_url(asset, low),
            status_code=307,
            headers={"Cache-Control": "public, max-age=86400"},
        )
    try:
        content = await request.app.state.spectral.tile(asset, low, high, monochrome=mode == "mono")
    except httpx.HTTPError as exc:
        raise HTTPException(502, "IRSA could not deliver the spectral channels; retry shortly") from exc
    return Response(content, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})
