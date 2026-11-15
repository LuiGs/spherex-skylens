import asyncio
import math
import re
import time
from typing import Any

import httpx

from .config import Settings
from .models import SmallBody

SB_IDENT_URL = "https://ssd-api.jpl.nasa.gov/sb_ident.api"
MJD_TO_JD = 2400000.5
_NUMBER = re.compile(r"-?\d+(?:\.\d*)?(?:E[+-]?\d+)?", re.IGNORECASE)


def _hms(ra_deg: float) -> str:
    hours = (ra_deg % 360) / 15
    h = int(hours)
    m = int((hours - h) * 60)
    s = ((hours - h) * 60 - m) * 60
    return f"{h:02d}-{m:02d}-{s:05.2f}"


def _dms(dec_deg: float) -> str:
    sign = "M" if dec_deg < 0 else ""
    value = abs(dec_deg)
    d = int(value)
    m = int((value - d) * 60)
    s = ((value - d) * 60 - m) * 60
    return f"{sign}{d:02d}-{m:02d}-{s:05.2f}"


def parse_hms(text: str) -> float:
    h, m, s = (float(part) for part in text.strip().split(":"))
    return 15 * (h + m / 60 + s / 3600)


def parse_dms(text: str) -> float:
    cleaned = text.strip().replace("'", " ").replace('"', " ")
    sign = -1.0 if cleaned.startswith("-") else 1.0
    d, m, s = (float(part) for part in cleaned.lstrip("+-").split())
    return sign * (d + m / 60 + s / 3600)


def _float(text: str) -> float | None:
    match = _NUMBER.search(text or "")
    if not match:
        return None
    value = float(match.group(0))
    return value if math.isfinite(value) else None


def parse_sb_ident(payload: dict[str, Any], kind: str) -> list[SmallBody]:
    """Rows of the second pass (high-fidelity orbit integration) of the JPL Small-Body Identification API."""
    fields = payload.get("fields_second") or payload.get("fields_first") or []
    rows = payload.get("data_second_pass") or payload.get("data_first_pass") or []
    index = {name: i for i, name in enumerate(fields)}

    def column(row: list[str], prefix: str) -> str:
        for name, i in index.items():
            if name.startswith(prefix):
                return row[i]
        return ""

    bodies: list[SmallBody] = []
    for row in rows:
        try:
            ra = parse_hms(column(row, "Astrometric RA"))
            dec = parse_dms(column(row, "Astrometric Dec"))
        except ValueError:
            continue
        bodies.append(
            SmallBody(
                name=column(row, "Object name").strip(),
                kind=kind,
                ra=ra,
                dec=dec,
                vmag=_float(column(row, "Visual magnitude")),
                ra_rate_arcsec_h=_float(column(row, "RA rate")),
                dec_rate_arcsec_h=_float(column(row, "Dec rate")),
                dist_arcsec=_float(column(row, "Dist. from center Norm")),
            )
        )
    return bodies


class JplClient:
    """Known asteroids and comets inside a field at a given time, via the NASA/JPL Small-Body Identification API."""

    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None) -> None:
        self._settings = settings
        self._client = client or httpx.AsyncClient(timeout=settings.jpl_timeout_s)
        self._cache: dict[tuple[float, float, float, float], tuple[float, list[SmallBody]]] = {}

    async def small_bodies(self, ra: float, dec: float, size_deg: float, mjd: float) -> list[SmallBody]:
        key = (round(ra, 3), round(dec, 3), round(size_deg, 3), round(mjd, 2))
        cached = self._cache.get(key)
        if cached and time.monotonic() - cached[0] < self._settings.search_cache_ttl_s:
            return cached[1]
        asteroids, comets = await asyncio.gather(
            self._query("a", ra, dec, size_deg, mjd), self._query("c", ra, dec, size_deg, mjd)
        )
        bodies = sorted(asteroids + comets, key=lambda b: (b.vmag is None, b.vmag or 0.0))
        self._cache[key] = (time.monotonic(), bodies)
        return bodies

    async def _query(self, kind: str, ra: float, dec: float, size_deg: float, mjd: float) -> list[SmallBody]:
        params = {
            "sb-kind": kind,
            "mag-required": "false",
            "two-pass": "true",
            "suppress-first-pass": "true",
            "req-elem": "false",
            "vmag-lim": str(self._settings.jpl_vmag_limit),
            "fov-ra-center": _hms(ra),
            "fov-dec-center": _dms(dec),
            "fov-ra-hwidth": f"{size_deg / 2:.4f}",
            "fov-dec-hwidth": f"{size_deg / 2:.4f}",
            "obs-time": f"{mjd + MJD_TO_JD:.6f}",
            "mpc-code": "500",
        }
        response = await self._client.get(SB_IDENT_URL, params=params)
        response.raise_for_status()
        return parse_sb_ident(response.json(), "asteroid" if kind == "a" else "comet")

    async def aclose(self) -> None:
        await self._client.aclose()
