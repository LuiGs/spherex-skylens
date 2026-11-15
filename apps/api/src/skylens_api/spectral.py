"""Display-only spectral composites from IRSA's stretched PNG HiPS channels."""

from __future__ import annotations

import asyncio
import hashlib
import io
import json
import os
from collections.abc import Awaitable, Callable
from pathlib import Path
from uuid import uuid4

import httpx
import numpy as np
from PIL import Image

from .config import Settings
from .irsa import IrsaClient

CHANNELS = json.loads(Path(__file__).with_name("spherex_channels.json").read_text())
WAVELENGTHS = CHANNELS["wavelengths_um"]
BLANK = set(CHANNELS["blank_frames"])


def channel_color(frame: int, low: int, high: int) -> tuple[float, float, float]:
    span = WAVELENGTHS[high] - WAVELENGTHS[low]
    t = (WAVELENGTHS[frame] - WAVELENGTHS[low]) / span if span else 0.5
    return max(0, 2 * t - 1), 1 - abs(2 * t - 1), max(0, 1 - 2 * t)


def compose_tiles(tiles: list[tuple[int, bytes]], low: int, high: int, monochrome: bool | None = None) -> bytes:
    monochrome = low == high if monochrome is None else monochrome
    result = np.zeros((512, 512, 3), dtype=np.float32)
    weight = np.zeros(3, dtype=np.float32)
    alpha = np.zeros((512, 512), dtype=np.uint8)
    for frame, content in tiles:
        if not content:
            continue
        with Image.open(io.BytesIO(content)) as image:
            rgba = np.asarray(image.convert("RGBA"))
        intensity = rgba[..., :3].astype(np.float32).mean(axis=-1) * (rgba[..., 3] / 255)
        color = np.array((1, 1, 1) if monochrome else channel_color(frame, low, high), dtype=np.float32)
        result += intensity[..., None] * color
        weight += color
        alpha = np.maximum(alpha, rgba[..., 3])
    # Normalize each display component so adding more channels does not clip the whole sky to white.
    result /= np.maximum(weight, 1)[None, None, :]
    output = np.dstack((np.clip(result, 0, 255).astype(np.uint8), alpha))
    buffer = io.BytesIO()
    Image.fromarray(output).save(buffer, format="PNG")
    return buffer.getvalue()


class SpectralTiles:
    def __init__(self, irsa: IrsaClient, settings: Settings) -> None:
        self.irsa = irsa
        self.base = f"{settings.irsa_base_url}/data/hips/SPHEREx/spherex_allsky_cube"
        self.cache = Path(settings.cache_dir).parent / "spectral-hips"
        self.limit = asyncio.Semaphore(8)
        self.pending: dict[str, asyncio.Task[bytes]] = {}
        self.waiters: dict[str, int] = {}

    async def cached(self, key: str, produce: Callable[[], Awaitable[bytes]]) -> bytes:
        path = self.cache / hashlib.sha256(key.encode()).hexdigest()
        if path.exists():
            return await asyncio.to_thread(path.read_bytes)
        if key in self.pending and self.pending[key].cancelling():
            self.pending.pop(key)
        if key not in self.pending:

            async def run() -> bytes:
                content = await produce()
                await asyncio.to_thread(self.store, path, content)
                return content

            task = asyncio.create_task(run())
            self.pending[key] = task

            def finished(completed: asyncio.Task[bytes]) -> None:
                if self.pending.get(key) is completed:
                    self.pending.pop(key, None)
                if not completed.cancelled():
                    completed.exception()

            task.add_done_callback(finished)
        task = self.pending[key]
        self.waiters[key] = self.waiters.get(key, 0) + 1
        try:
            return await asyncio.shield(task)
        finally:
            self.waiters[key] -= 1
            if not self.waiters[key]:
                self.waiters.pop(key)
                if not task.done():
                    task.cancel()

    @staticmethod
    def store(path: Path, content: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
        try:
            temporary.write_bytes(content)
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)

    async def source(self, asset: str) -> bytes:
        url = f"{self.base}/{asset}"

        async def retrieve() -> bytes:
            async with self.limit:
                try:
                    return await self.irsa.fetch_cutout(url)
                except httpx.HTTPStatusError as exc:
                    if exc.response.status_code == 404:
                        return b""
                    raise

        return await self.cached(url, retrieve)

    async def tile(self, asset: str, low: int, high: int, monochrome: bool = False) -> bytes:
        async def produce() -> bytes:
            frames = [frame for frame in range(low, high + 1) if frame not in BLANK]

            # HiPS stores channel zero without a suffix; subsequent frames use _1 ... _101.
            async def get(frame: int) -> tuple[int, bytes]:
                name = asset if frame == 0 else asset.removesuffix(".png") + f"_{frame}.png"
                return frame, await self.source(name)

            tiles = await asyncio.gather(*(get(frame) for frame in frames))
            return await asyncio.to_thread(compose_tiles, tiles, low, high, monochrome)

        return await self.cached(f"rgb-v1:{self.base}:{asset}:{low}:{high}:{monochrome}", produce)
