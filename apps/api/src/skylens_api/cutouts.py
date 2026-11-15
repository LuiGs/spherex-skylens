"""IRSA cutout retrieval and compact, atomic on-disk caching."""

from __future__ import annotations

import asyncio
import hashlib
import io
import os
import tempfile
from pathlib import Path

from astropy.io import fits

from .irsa import IrsaClient

_COMPACT_EXTENSIONS = ("IMAGE", "FLAGS", "VARIANCE", "ZODI")
# Per-pixel wavelength lookup table used by the spectrum endpoint.
_OPTIONAL_EXTENSIONS = ("WCS-WAVE",)


class CutoutStore:
    def __init__(self, cache_dir: str, irsa: IrsaClient) -> None:
        self.cache_dir = Path(cache_dir)
        self.irsa = irsa

    def path_for(self, url: str) -> Path:
        return self.cache_dir / f"{hashlib.sha256(url.encode()).hexdigest()}.fits"

    async def get(self, url: str) -> bytes:
        path = self.path_for(url)
        if path.exists():
            return await asyncio.to_thread(path.read_bytes)
        content = await self.irsa.fetch_cutout(url)
        await asyncio.to_thread(self._store_compact, path, content)
        return await asyncio.to_thread(path.read_bytes)

    @staticmethod
    def _store_compact(path: Path, content: bytes) -> None:
        with fits.open(io.BytesIO(content), memmap=False) as source:
            compact = fits.HDUList(
                [
                    fits.PrimaryHDU(header=source[0].header.copy()),
                    *[
                        fits.ImageHDU(data=source[name].data.copy(), header=source[name].header.copy(), name=name)
                        for name in _COMPACT_EXTENSIONS
                    ],
                    *[source[name].copy() for name in _OPTIONAL_EXTENSIONS if name in source],
                ]
            )
            path.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(
                dir=path.parent, prefix=f".{path.name}.", suffix=".tmp", delete=False
            ) as file:
                temporary = Path(file.name)
            try:
                compact.writeto(temporary, overwrite=True)
                os.replace(temporary, path)
            finally:
                temporary.unlink(missing_ok=True)
