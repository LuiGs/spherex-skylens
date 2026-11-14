"""Thin client for the NASA/IPAC IRSA services that expose SPHEREx data."""

import asyncio
import csv
import io
import re

import httpx

from .config import Settings
from .models import Observation

_DETECTOR_RE = re.compile(r"SPHEREx-D(\d)")


def build_cutout_url(access_url: str, ra: float, dec: float, size_deg: float) -> str:
    return f"{access_url}?center={ra},{dec}d&size={size_deg}"


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

    async def search_spectral_images(
        self, ra: float, dec: float, size_deg: float, collections: list[str] | None = None
    ) -> list[Observation]:
        """Simple Image Access (SIA v2) query for SPHEREx Level 2 spectral images covering a position."""
        params: list[tuple[str, str]] = [
            ("POS", f"CIRCLE {ra} {dec} 0.0003"),
            ("RESPONSEFORMAT", "CSV"),
        ]
        params += [("COLLECTION", c) for c in collections or self._settings.sia_collections]
        response = await self._get_with_retry(f"{self._settings.irsa_base_url}/SIA", params)
        return parse_sia_csv(response.text, ra, dec, size_deg)

    async def _get_with_retry(self, url: str, params: list[tuple[str, str]]) -> httpx.Response:
        """IRSA intermittently answers 502/503 ("Server busy"); retry those with exponential backoff."""
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
