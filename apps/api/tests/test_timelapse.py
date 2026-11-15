import io
from pathlib import Path

import httpx
import numpy as np
import pytest
import respx
from astropy.io import fits
from astropy.wcs import WCS
from fastapi.testclient import TestClient
from PIL import Image

from skylens_api.config import get_settings
from skylens_api.main import create_app
from skylens_api.models import Observation
from skylens_api.timelapse import coadd_fits, fill_holes, group_epochs, render_png, select_epoch_images

RA = 133.795129
DEC = -7.245147
SIA_CSV = """s_ra,s_dec,energy_bandpassname,obs_id,em_min,em_max,access_url,t_min,t_max,obs_collection
133.7,-7.2,SPHEREx-D1,2025W19_D1,0.75e-6,1.1e-6,https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/one_D1.fits,60800.7,60800.71,spherex_dr1
"""


def observation(detector: int, start: float, obs_id: str | None = None, end: float | None = None) -> Observation:
    return Observation(
        obs_id=obs_id or f"{detector}-{start}",
        collection="spherex_dr1",
        detector=detector,
        mjd_start=start,
        mjd_end=end if end is not None else start,
        wavelength_min_um=1.0,
        wavelength_max_um=2.0,
        access_url=f"https://irsa.example/{detector}-{start}.fits",
        cutout_url=f"https://irsa.example/{detector}-{start}.fits?center={RA},{DEC}d&size=0.01",
    )


def make_fits(
    *,
    value: float = 0.0,
    variance: float = 1.0,
    star: tuple[int, int] | None = None,
    flags: int = 0,
    size: int = 9,
    ra: float = RA,
    dec: float = DEC,
) -> bytes:
    wcs = WCS(naxis=2)
    wcs.wcs.crpix = [(size + 1) / 2, (size + 1) / 2]
    wcs.wcs.crval = [ra, dec]
    wcs.wcs.ctype = ["RA---TAN-SIP", "DEC--TAN-SIP"]
    wcs.wcs.cdelt = [-1 / 3600, 1 / 3600]
    header = wcs.to_header(relax=True)
    image = np.full((size, size), value, dtype=np.float32)
    if star is not None:
        image[star] = 100
    flags_array = np.zeros((size, size), dtype=np.int32)
    flags_array[size // 2, size // 2] = flags
    flag_header = fits.Header({"MSKN0000": "TRANSIENT", "MSKM0000": 1, "MSKN0001": "SOURCE", "MSKM0001": 2})
    output = io.BytesIO()
    fits.HDUList(
        [
            fits.PrimaryHDU(),
            fits.ImageHDU(image, header=header, name="IMAGE"),
            fits.ImageHDU(flags_array, header=flag_header, name="FLAGS"),
            fits.ImageHDU(np.full((size, size), variance, dtype=np.float32), header=header, name="VARIANCE"),
            fits.ImageHDU(np.zeros((size, size), dtype=np.float32), header=header, name="ZODI"),
            fits.ImageHDU(np.ones(451), name="EPSF"),
            fits.ImageHDU(np.ones((1,)), name="WCS-WAVE"),
        ]
    ).writeto(output)
    return output.getvalue()


def test_group_epochs_sorts_and_splits_after_gap() -> None:
    observations = [
        observation(2, 40),
        observation(1, 0, end=5),
        observation(3, 20),
        observation(4, 75),
    ]

    epochs = group_epochs(observations, gap_days=30)

    assert [[item.mjd_start for item in epoch.observations] for epoch in epochs] == [[0, 20, 40], [75]]
    assert [(epoch.mjd_start, epoch.mjd_end) for epoch in epochs] == [(0, 40), (75, 75)]


def test_select_epoch_images_round_robins_and_caps() -> None:
    observations = [observation(1, index) for index in range(6)]
    observations += [observation(2, index + 1) for index in range(6)]
    observations += [observation(3, index + 2) for index in range(6)]

    epochs = select_epoch_images(observations, max_images=7, gap_days=30)

    assert len(epochs) == 1
    assert len(epochs[0].observations) == 7
    assert [sum(item.detector == detector for item in epochs[0].observations) for detector in (1, 2, 3)] == [3, 2, 2]


def test_flagged_pixels_are_excluded_but_source_pixels_are_kept() -> None:
    transient = make_fits(value=10, flags=1)
    source = make_fits(value=20, flags=2)

    result = coadd_fits([transient, source], RA, DEC, 9 / 3600, 1, ["TRANSIENT"])

    assert result[4, 4] == pytest.approx(20)


def test_coadd_uses_inverse_variance_weights() -> None:
    result = coadd_fits(
        [make_fits(value=10, variance=1), make_fits(value=20, variance=4)],
        RA,
        DEC,
        9 / 3600,
        1,
        ["TRANSIENT"],
    )

    assert result[4, 4] == pytest.approx(12)


def test_star_shift_has_expected_astronomical_and_png_orientation() -> None:
    first = coadd_fits([make_fits(star=(4, 4))], RA, DEC, 9 / 3600, 1, [])
    shifted = coadd_fits([make_fits(star=(5, 3))], RA, DEC, 9 / 3600, 1, [])
    assert np.unravel_index(np.nanargmax(first), first.shape) == (4, 4)
    assert np.unravel_index(np.nanargmax(shifted), shifted.shape) == (5, 3)
    rendered = np.asarray(Image.open(io.BytesIO(render_png(shifted, 0, 100))))
    assert np.unravel_index(rendered.argmax(), rendered.shape) == (3, 3)


@respx.mock
def test_timelapse_metadata_frame_and_cached_compact_cutout(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SKYLENS_CACHE_DIR", str(tmp_path))
    monkeypatch.setenv("SKYLENS_HTTP_RETRY_BACKOFF_S", "0")
    get_settings.cache_clear()
    cutout_url = "https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/one_D1.fits"
    sia = respx.get("https://irsa.ipac.caltech.edu/SIA").mock(return_value=httpx.Response(200, text=SIA_CSV))
    cutout = respx.get(cutout_url).mock(side_effect=[httpx.Response(503), httpx.Response(200, content=make_fits())])
    try:
        with TestClient(create_app()) as client:
            metadata = client.get(
                "/api/v1/timelapse",
                params={"ra": RA, "dec": DEC, "size": 0.005},
            )
            assert metadata.status_code == 200
            body = metadata.json()
            assert body["collections"] == ["spherex_dr1"]
            assert body["width"] == body["height"] == 3
            assert body["epochs"][0]["n_images"] == 1
            assert "frame?" in body["epochs"][0]["frame_url"]
            assert cutout.call_count == 2

            frame = client.get(body["epochs"][0]["frame_url"])
            assert frame.status_code == 200
            assert frame.headers["content-type"] == "image/png"
            assert frame.headers["cache-control"] == "public, max-age=86400"
            assert frame.content[:8] == b"\x89PNG\r\n\x1a\n"
            assert Image.open(io.BytesIO(frame.content)).size == (3, 3)

            again = client.get("/api/v1/timelapse", params={"ra": RA, "dec": DEC, "size": 0.005})
            assert again.status_code == 200
            assert cutout.call_count == 2

            cached = next(tmp_path.glob("*.fits"))
            with fits.open(cached) as hdus:
                assert {hdu.name for hdu in hdus} == {"PRIMARY", "IMAGE", "FLAGS", "VARIANCE", "ZODI"}

            missing = client.get(
                "/api/v1/timelapse/frame",
                params={"ra": RA, "dec": DEC, "size": 0.005, "epoch": 4},
            )
            assert missing.status_code == 404
    finally:
        get_settings.cache_clear()
    assert sia.call_count == 1


@respx.mock
def test_timelapse_without_observations_returns_empty_epochs() -> None:
    empty_csv = "s_ra,s_dec,energy_bandpassname,obs_id,em_min,em_max,access_url,t_min,t_max,obs_collection\n"
    respx.get("https://irsa.ipac.caltech.edu/SIA").mock(return_value=httpx.Response(200, text=empty_csv))
    with TestClient(create_app()) as client:
        response = client.get("/api/v1/timelapse", params={"ra": RA, "dec": DEC})
    assert response.status_code == 200
    assert response.json()["epochs"] == []


@respx.mock
def test_persistent_cutout_failure_becomes_502(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SKYLENS_CACHE_DIR", str(tmp_path))
    monkeypatch.setenv("SKYLENS_HTTP_RETRY_BACKOFF_S", "0")
    get_settings.cache_clear()
    cutout_url = "https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/one_D1.fits"
    route = respx.get("https://irsa.ipac.caltech.edu/SIA").mock(return_value=httpx.Response(200, text=SIA_CSV))
    failure = respx.get(cutout_url).mock(return_value=httpx.Response(503))
    try:
        with TestClient(create_app()) as client:
            response = client.get("/api/v1/timelapse", params={"ra": RA, "dec": DEC, "size": 0.005})
        assert response.status_code == 502
        assert failure.call_count == 4
        assert route.call_count == 1
    finally:
        get_settings.cache_clear()


def test_fill_holes_paints_saturated_cores_but_keeps_coverage_gaps() -> None:
    data = np.full((5, 5), 1.0)
    data[2, 2] = np.nan
    data[1, 2] = 9.0
    data[:, 0] = np.nan
    filled = fill_holes(data)
    assert filled[2, 2] == 9.0
    assert np.isnan(filled[:, 0]).all()
