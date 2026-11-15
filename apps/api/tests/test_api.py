from pathlib import Path

import httpx
import respx
from fastapi.testclient import TestClient

from skylens_api.config import get_settings
from skylens_api.irsa import parse_sia_csv
from skylens_api.main import create_app

FIXTURE = (Path(__file__).parent / "fixtures_sia.csv").read_text()


def test_parse_sia_csv_sorts_by_time_and_detector() -> None:
    obs = parse_sia_csv(FIXTURE, 133.795129, -7.245147, 0.05)
    assert [(o.mjd_start, o.detector) for o in obs] == [(60800.700028, 3), (60800.700028, 6), (60990.1, 1)]
    assert obs[0].cutout_url.endswith("a_D3.fits?center=133.795129,-7.245147&size=0.05")
    assert round(obs[0].wavelength_min_um, 4) == 1.6301


def test_health() -> None:
    with TestClient(create_app()) as client:
        assert client.get("/health").json() == {"status": "ok"}


@respx.mock
def test_observations_endpoint_filters_detector() -> None:
    respx.get("https://irsa.ipac.caltech.edu/SIA").mock(return_value=httpx.Response(200, text=FIXTURE))
    with TestClient(create_app()) as client:
        response = client.get("/api/v1/observations", params={"ra": 133.795129, "dec": -7.245147, "detector": 3})
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    assert body["observations"][0]["detector"] == 3


@respx.mock
def test_observations_endpoint_retries_transient_irsa_errors(monkeypatch) -> None:
    monkeypatch.setenv("SKYLENS_HTTP_RETRY_BACKOFF_S", "0")
    get_settings.cache_clear()
    route = respx.get("https://irsa.ipac.caltech.edu/SIA")
    route.side_effect = [httpx.Response(502), httpx.Response(200, text=FIXTURE)]
    with TestClient(create_app()) as client:
        response = client.get("/api/v1/observations", params={"ra": 133.795129, "dec": -7.245147})
    get_settings.cache_clear()
    assert response.status_code == 200
    assert route.call_count == 2


@respx.mock
def test_observations_endpoint_maps_irsa_errors_to_502(monkeypatch) -> None:
    monkeypatch.setenv("SKYLENS_HTTP_RETRY_BACKOFF_S", "0")
    get_settings.cache_clear()
    respx.get("https://irsa.ipac.caltech.edu/SIA").mock(return_value=httpx.Response(503))
    with TestClient(create_app()) as client:
        response = client.get("/api/v1/observations", params={"ra": 10, "dec": 10})
    get_settings.cache_clear()
    assert response.status_code == 502


def test_cors_allows_preview_hosts_matching_the_regex(monkeypatch) -> None:
    monkeypatch.setenv("SKYLENS_CORS_ORIGINS", '["https://app.example.net"]')
    monkeypatch.setenv("SKYLENS_CORS_ORIGIN_REGEX", r"https://app-\d+\.example\.net")
    get_settings.cache_clear()
    try:
        client = TestClient(create_app())
        allowed = client.get("/health", headers={"Origin": "https://app-12.example.net"})
        denied = client.get("/health", headers={"Origin": "https://evil.example.net"})
    finally:
        get_settings.cache_clear()
    assert allowed.headers["access-control-allow-origin"] == "https://app-12.example.net"
    assert "access-control-allow-origin" not in denied.headers
