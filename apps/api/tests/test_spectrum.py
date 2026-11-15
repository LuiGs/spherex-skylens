import io
import warnings
from pathlib import Path

import httpx
import pytest
import respx
from astropy.io import fits
from astropy.wcs import WCS, FITSFixedWarning
from fastapi.testclient import TestClient

from skylens_api.config import get_settings
from skylens_api.main import create_app
from skylens_api.models import Observation
from skylens_api.spectrum import spectral_point, spread_observations

# Real 18x18 px SPHEREx DR1 cutout (detector D3) around WISE 0855, EPSF table stripped.
CUTOUT = (Path(__file__).parent / "fixtures_cutout.fits").read_bytes()
RA, DEC = 133.7795, -7.2425
BAD_FLAGS = get_settings().timelapse_bad_flags
warnings.simplefilter("ignore", FITSFixedWarning)


def observation(detector: int, start: float) -> Observation:
    return Observation(
        obs_id=f"{detector}-{start}",
        collection="spherex_dr1",
        detector=detector,
        mjd_start=start,
        mjd_end=start,
        wavelength_min_um=1.0,
        wavelength_max_um=2.0,
        access_url=f"https://irsa.ipac.caltech.edu/ibe/{detector}-{start}.fits",
        cutout_url=f"https://irsa.ipac.caltech.edu/ibe/{detector}-{start}.fits?center={RA},{DEC}&size=0.005",
    )


def test_spectral_point_reads_wavelength_from_the_lookup_table() -> None:
    point = spectral_point(CUTOUT, observation(3, 60800.7), RA, DEC, BAD_FLAGS)
    assert not isinstance(point, str)
    assert 1.6 < point.wavelength_um < 2.4
    assert 0 < point.bandwidth_um < 0.2
    assert point.error > 0


def test_spectral_point_outside_the_cutout_is_skipped() -> None:
    assert spectral_point(CUTOUT, observation(3, 60800.7), RA + 1, DEC, BAD_FLAGS) == "outside"


def test_saturated_pixels_are_reported() -> None:
    with fits.open(io.BytesIO(CUTOUT)) as hdus:
        column, row = (int(round(v)) for v in WCS(hdus["IMAGE"].header).celestial.all_world2pix([[RA, DEC]], 0)[0])
        names = {str(hdus["FLAGS"].header[key]): key[4:] for key in hdus["FLAGS"].header if key.startswith("MSKN")}
        hdus["FLAGS"].data[row, column] = hdus["FLAGS"].header[f"MSKM{names['OVERFLOW']}"]
        buffer = io.BytesIO()
        hdus.writeto(buffer)
    assert spectral_point(buffer.getvalue(), observation(3, 60800.7), RA, DEC, BAD_FLAGS) == "saturated"


def test_spread_observations_balances_detectors_and_time() -> None:
    observations = [observation(1, 60800 + day) for day in range(20)] + [observation(2, 60800), observation(2, 60900)]
    chosen = spread_observations(observations, 6)
    assert [item.detector for item in chosen] == [1, 1, 1, 1, 2, 2]
    assert [item.mjd_start for item in chosen if item.detector == 1] == [60800, 60805, 60810, 60815]


@respx.mock
def test_spectrum_endpoint(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SKYLENS_CACHE_DIR", str(tmp_path))
    get_settings.cache_clear()
    sia = (
        "s_ra,s_dec,energy_bandpassname,obs_id,em_min,em_max,access_url,t_min,t_max,obs_collection\n"
        f"{RA},{DEC},SPHEREx-D3,a,1.6e-6,2.4e-6,https://irsa.ipac.caltech.edu/ibe/a.fits,60800.7,60800.7,spherex_dr1\n"
        f"{RA},{DEC},SPHEREx-D3,b,1.6e-6,2.4e-6,https://irsa.ipac.caltech.edu/ibe/b.fits,60900.7,60900.7,spherex_dr1\n"
    )
    respx.get("https://irsa.ipac.caltech.edu/SIA").mock(return_value=httpx.Response(200, text=sia))
    respx.get("https://irsa.ipac.caltech.edu/ibe/a.fits").mock(return_value=httpx.Response(200, content=CUTOUT))
    respx.get("https://irsa.ipac.caltech.edu/ibe/b.fits").mock(return_value=httpx.Response(404))
    try:
        with TestClient(create_app()) as client:
            response = client.get("/api/v1/spectrum", params={"ra": RA, "dec": DEC})
    finally:
        get_settings.cache_clear()
    assert response.status_code == 200
    body = response.json()
    assert body["n_available"] == 2
    assert body["n_images"] == 2
    assert len(body["points"]) == 1
    assert body["points"][0]["detector"] == 3
    assert body["n_saturated"] == body["n_flagged"] == 0
