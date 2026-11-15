import asyncio
import io

import httpx
import numpy as np
import pytest
import respx
from fastapi.testclient import TestClient
from PIL import Image

from skylens_api.config import Settings, get_settings
from skylens_api.main import create_app
from skylens_api.spectral import WAVELENGTHS, SpectralTiles, channel_color, compose_tiles


def png(value):
    buffer = io.BytesIO()
    Image.new("RGB", (512, 512), (value, value, value)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_color_depends_on_wavelength_not_channel_index():
    assert channel_color(0, 0, 101) == (0, 0, 1)
    assert channel_color(101, 0, 101) == (1, 0, 0)
    t = (WAVELENGTHS[60] - WAVELENGTHS[0]) / (WAVELENGTHS[101] - WAVELENGTHS[0])
    assert channel_color(60, 0, 101)[0] == pytest.approx(2 * t - 1)
    assert t != pytest.approx(60 / 101)


def test_composite_uses_the_pixels_from_both_channels():
    result = compose_tiles([(0, png(25)), (101, png(200))], 0, 101)
    with Image.open(io.BytesIO(result)) as image:
        assert image.getpixel((10, 10)) == (200, 0, 25, 255)


def test_monochrome_preserves_intensity_and_missing_tiles_remain_transparent():
    with Image.open(io.BytesIO(compose_tiles([(10, png(72))], 10, 10))) as image:
        assert image.getpixel((0, 0)) == (72, 72, 72, 255)
    with Image.open(io.BytesIO(compose_tiles([], 50, 51))) as image:
        assert not np.asarray(image).any()


@respx.mock
def test_endpoint_frame_zero_has_no_suffix_and_tiles_are_cached(tmp_path, monkeypatch):
    monkeypatch.setenv("SKYLENS_CACHE_DIR", str(tmp_path / "cutouts"))
    get_settings.cache_clear()
    first = respx.get(
        "https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube/Norder0/Dir0/Npix0.png"
    ).mock(return_value=httpx.Response(200, content=png(40)))
    second = respx.get(
        "https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube/Norder0/Dir0/Npix0_1.png"
    ).mock(return_value=httpx.Response(200, content=png(90)))
    try:
        with TestClient(create_app()) as client:
            url = "/api/v1/spectral/hips/color/0/1/Norder0/Dir0/Npix0.png"
            response = client.get(url)
            assert response.status_code == 200
            assert client.get(url).content == response.content
            assert first.call_count == second.call_count == 1
            assert client.get("/api/v1/spectral/hips/color/90/10/properties").status_code == 422
            assert client.get("/api/v1/spectral/hips/color/0/1/Norder0/Dir0/Npix99.png").status_code == 404
            assert "dataproduct_type = image" in client.get("/api/v1/spectral/hips/color/0/1/properties").text
    finally:
        get_settings.cache_clear()


@respx.mock
def test_blank_channels_are_not_requested(tmp_path, monkeypatch):
    monkeypatch.setenv("SKYLENS_CACHE_DIR", str(tmp_path / "cutouts"))
    get_settings.cache_clear()
    try:
        with TestClient(create_app()) as client:
            assert client.get("/api/v1/spectral/hips/color/50/51/Norder0/Dir0/Npix0.png").status_code == 200
            assert not respx.calls
    finally:
        get_settings.cache_clear()


def test_preparation_warms_center_and_fallback_before_returning(monkeypatch):
    calls = []

    async def tile(self, asset, low, high, monochrome=False):
        calls.append((asset, low, high, monochrome))
        return png(72)

    monkeypatch.setattr(SpectralTiles, "tile", tile)
    with TestClient(create_app()) as client:
        response = client.get("/api/v1/spectral/hips/mono/10/10/prepare?ra=0&dec=89&order=5")
        assert response.status_code == 200
        assert response.json() == {"ready": True}
        assert len(calls) == 2
        assert calls[0][0].startswith("Norder2/")
        assert calls[1][0].startswith("Norder5/")
        assert all(item[1:] == (10, 10, True) for item in calls)


def test_cached_jobs_survive_one_cancelled_waiter_but_cancel_when_unneeded(tmp_path):
    async def scenario():
        service = SpectralTiles(None, Settings(cache_dir=str(tmp_path / "cutouts")))
        gate = asyncio.Event()
        started = 0

        async def produce():
            nonlocal started
            started += 1
            await gate.wait()
            return b"image"

        first = asyncio.create_task(service.cached("shared", produce))
        second = asyncio.create_task(service.cached("shared", produce))
        await asyncio.sleep(0.01)
        first.cancel()
        await asyncio.gather(first, return_exceptions=True)
        gate.set()
        assert await second == b"image"
        assert started == 1
        gate.clear()
        abandoned = asyncio.create_task(service.cached("abandoned", produce))
        await asyncio.sleep(0.01)
        job = service.pending["abandoned"]
        abandoned.cancel()
        await asyncio.gather(abandoned, return_exceptions=True)
        await asyncio.sleep(0.01)
        assert job.cancelled()

    asyncio.run(scenario())
