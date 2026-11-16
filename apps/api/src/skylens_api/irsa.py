"""Thin client for the NASA/IPAC IRSA services that expose SPHEREx data."""

import asyncio
import csv
import io
import re
import time

import httpx

from .config import Settings
from .models import Observation

_DETECTOR_RE = re.compile(r"SPHEREx-D(\d)")


def build_cutout_url(access_url: str, ra: float, dec: float, size_deg: float) -> str:
    # IRSA answers 503 when `center` carries a unit suffix such as "d".
    return f"{access_url}?center={ra},{dec}&size={size_deg}"


def parse_sia_csv(text: str, ra: float, dec: float, size_deg: float) -> list[Observation]:
    observations: list[Observation] = []
    for row in csv.DictReader(io.StringIO(text)):
        match = _DETECTOR_RE.search(row.get("energy_bandpassname", ""))
        if not match or not row.get("access_url"):
            continue
        observations.append(
            Observation(
                obs_id=row["obs_id"],
                collection=row.get("obs_collection", ""),
                detector=int(match.group(1)),
                mjd_start=float(row["t_min"]),
                mjd_end=float(row.get("t_max") or row["t_min"]),
                wavelength_min_um=float(row["em_min"]) * 1e6,
                wavelength_max_um=float(row["em_max"]) * 1e6,
                access_url=row["access_url"],
                cutout_url=build_cutout_url(row["access_url"], ra, dec, size_deg),
            )
        )
    observations.sort(key=lambda o: (o.mjd_start, o.detector))
    return observations


class IrsaClient:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None) -> None:
        self._settings = settings
        self._client = client or httpx.AsyncClient(timeout=settings.http_timeout_s)
        self._search_cache: dict[tuple[float, float, tuple[str, ...]], tuple[float, str]] = {}
        self._inflight: dict[tuple[float, float, tuple[str, ...]], asyncio.Future[str]] = {}

    async def search_spectral_images(
        self, ra: float, dec: float, size_deg: float, collections: list[str] | None = None
    ) -> list[Observation]:
        """Simple Image Access (SIA v2) query for SPHEREx Level 2 spectral images covering a position.

        IRSA takes ~20 s per query, so the raw CSV is cached per position (rounded to ~0.4") and shared
        by every caller: the observations list, the timelapse and the spectrum of the same spot pay once.
        """
        key = (round(ra, 4), round(dec, 4), tuple(collections or self._settings.sia_collections))
        return parse_sia_csv(await self._sia_csv(key), ra, dec, size_deg)

    async def _sia_csv(self, key: tuple[float, float, tuple[str, ...]]) -> str:
        cached = self._search_cache.get(key)
        if cached and time.monotonic() - cached[0] < self._settings.search_cache_ttl_s:
            return cached[1]
        task = self._inflight.get(key)
        if task is None:
            task = asyncio.ensure_future(self._fetch_sia_csv(key))
            self._inflight[key] = task
            task.add_done_callback(lambda _: self._inflight.pop(key, None))
        text = await asyncio.shield(task)
        self._search_cache[key] = (time.monotonic(), text)
        while len(self._search_cache) > self._settings.search_cache_max_entries:
            del self._search_cache[next(iter(self._search_cache))]
        return text

    async def _fetch_sia_csv(self, key: tuple[float, float, tuple[str, ...]]) -> str:
        ra, dec, collections = key
        params: list[tuple[str, str]] = [
            ("POS", f"CIRCLE {ra} {dec} 0.0003"),
            ("RESPONSEFORMAT", "CSV"),
        ]
        params += [("COLLECTION", c) for c in collections]
        response = await self._get_with_retry(f"{self._settings.irsa_base_url}/SIA", params)
        return response.text

    async def warm(self, positions: list[tuple[float, float]]) -> None:
        """Pre-queries IRSA for well-known positions so the first visitor does not wait; failures are ignored."""
        for ra, dec in positions:
            try:
                await self.search_spectral_images(ra, dec, 0.05)
            except (httpx.HTTPError, asyncio.CancelledError):
                return

    async def fetch_cutout(self, url: str) -> bytes:
        """Fetch a cutout through the same retry policy as SIA requests."""
        response = await self._get_with_retry(url)
        return response.content

    async def _get_with_retry(self, url: str, params: list[tuple[str, str]] | None = None) -> httpx.Response:
        """IRSA intermittently answers 502/503 ("Server busy"); retry those with exponential backoff.

        `params=None` keeps the query already in `url`: httpx drops it when given an empty list.
        """
        attempts = self._settings.http_retries + 1
        for attempt in range(attempts):
            response = await self._client.get(url, params=params)
            if response.status_code < 500 or attempt == attempts - 1:
                break
            await asyncio.sleep(self._settings.http_retry_backoff_s * 2**attempt)
        response.raise_for_status()
        return response

    async def aclose(self) -> None:
        await self._client.aclose()
