from __future__ import annotations

import asyncio
import math
import time
from typing import Annotated
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import Response as RawResponse

from ..config import Settings
from ..cutouts import CutoutStore
from ..irsa import IrsaClient
from ..models import TimelapseEpoch, TimelapseResponse, TimelapseStretch
from ..timelapse import SelectedEpoch, coadd_fits, render_png, select_epoch_images, shared_stretch

router = APIRouter(prefix="/api/v1/timelapse", tags=["timelapse"])


class TimelapseService:
    def __init__(self, irsa: IrsaClient, settings: Settings) -> None:
        self.irsa = irsa
        self.settings = settings
        self.store = CutoutStore(settings.cache_dir, irsa)
        self.semaphore = asyncio.Semaphore(settings.timelapse_max_concurrency)
        self._search_cache: dict[tuple[float, float, float], tuple[float, list]] = {}
        self._coadd_cache: dict[tuple[float, float, float, int | None], tuple[list[SelectedEpoch], list]] = {}

    async def search(self, ra: float, dec: float, size: float):
        key = (ra, dec, size)
        cached = self._search_cache.get(key)
        if cached and time.monotonic() - cached[0] < self.settings.search_cache_ttl_s:
            return cached[1]
        observations = await self.irsa.search_spectral_images(ra, dec, size)
        self._search_cache[key] = (time.monotonic(), observations)
        return observations

    async def epoch_coadds(self, ra: float, dec: float, size: float, detector: int | None):
        key = (ra, dec, size, detector)
        if key in self._coadd_cache:
            return self._coadd_cache[key]
        observations = await self.search(ra, dec, size)
        if detector is not None:
            observations = [item for item in observations if item.detector == detector]
        epochs = select_epoch_images(
            observations, self.settings.timelapse_max_images_per_epoch, self.settings.timelapse_epoch_gap_days
        )

        async def retrieve(url: str) -> bytes:
            async with self.semaphore:
                return await self.store.get(url)

        cutout_groups = await asyncio.gather(
            *(asyncio.gather(*(retrieve(item.cutout_url) for item in epoch.observations)) for epoch in epochs)
        )
        coadds = await asyncio.gather(
            *(
                asyncio.to_thread(
                    coadd_fits,
                    cutouts,
                    ra,
                    dec,
                    size,
                    self.settings.timelapse_pixel_scale_arcsec,
                    self.settings.timelapse_bad_flags,
                )
                for cutouts in cutout_groups
            )
        )
        result = (epochs, coadds)
        self._coadd_cache[key] = result
        return result


def get_service(request: Request) -> TimelapseService:
    return request.app.state.timelapse


async def _response(
    service: TimelapseService, ra: float, dec: float, size: float, detector: int | None
) -> TimelapseResponse:
    observations = await service.search(ra, dec, size)
    if detector is not None:
        observations = [item for item in observations if item.detector == detector]
    epochs, coadds = await service.epoch_coadds(ra, dec, size, detector)
    settings = service.settings
    vmin, vmax = shared_stretch(coadds, settings.timelapse_stretch_percentiles)
    width = coadds[0].shape[1] if coadds else max(1, math.ceil(size * 3600 / settings.timelapse_pixel_scale_arcsec))
    height = coadds[0].shape[0] if coadds else width
    collection_names = sorted({item.collection for item in observations if item.collection})
    epoch_responses: list[TimelapseEpoch] = []
    for index, epoch in enumerate(epochs):
        query = {"ra": ra, "dec": dec, "size": size, "epoch": index, "vmin": vmin, "vmax": vmax}
        if detector is not None:
            query["detector"] = detector
        epoch_responses.append(
            TimelapseEpoch(
                index=index,
                mjd_start=epoch.group.mjd_start,
                mjd_end=epoch.group.mjd_end,
                mjd_mid=epoch.group.mjd_mid,
                n_images=len(epoch.observations),
                n_available=len(epoch.group.observations),
                detectors=sorted({item.detector for item in epoch.group.observations}),
                frame_url=f"/api/v1/timelapse/frame?{urlencode(query)}",
            )
        )
    return TimelapseResponse(
        ra=ra,
        dec=dec,
        size_deg=size,
        detector=detector,
        collections=collection_names,
        pixel_scale_arcsec=settings.timelapse_pixel_scale_arcsec,
        width=width,
        height=height,
        stretch=TimelapseStretch(vmin=vmin, vmax=vmax),
        epochs=epoch_responses,
    )


@router.get("", response_model=TimelapseResponse)
async def list_timelapse(
    service: Annotated[TimelapseService, Depends(get_service)],
    ra: Annotated[float, Query(ge=0, lt=360, description="Right ascension (deg, ICRS)")],
    dec: Annotated[float, Query(ge=-90, le=90, description="Declination (deg, ICRS)")],
    size: Annotated[float, Query(gt=0, le=1, description="Cutout size (deg)")] = 0.05,
    detector: Annotated[int | None, Query(ge=1, le=6)] = None,
) -> TimelapseResponse:
    try:
        return await _response(service, ra, dec, size, detector)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"IRSA request failed: {exc}") from exc


@router.get("/frame")
async def timelapse_frame(
    service: Annotated[TimelapseService, Depends(get_service)],
    ra: Annotated[float, Query(ge=0, lt=360)],
    dec: Annotated[float, Query(ge=-90, le=90)],
    size: Annotated[float, Query(gt=0, le=1)] = 0.05,
    epoch: Annotated[int, Query(ge=0)] = 0,
    detector: Annotated[int | None, Query(ge=1, le=6)] = None,
    vmin: float | None = None,
    vmax: float | None = None,
) -> Response:
    try:
        metadata = await _response(service, ra, dec, size, detector)
        if epoch >= len(metadata.epochs):
            raise HTTPException(status_code=404, detail="Epoch not found")
        _, coadds = await service.epoch_coadds(ra, dec, size, detector)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"IRSA request failed: {exc}") from exc
    frame = coadds[epoch]
    if vmin is None or vmax is None:
        local_min, local_max = shared_stretch([frame], service.settings.timelapse_stretch_percentiles)
        vmin = local_min if vmin is None else vmin
        vmax = local_max if vmax is None else vmax
    png = await asyncio.to_thread(render_png, frame, vmin, vmax)
    return RawResponse(content=png, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})
