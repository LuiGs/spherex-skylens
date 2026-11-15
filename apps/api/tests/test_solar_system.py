import json
from pathlib import Path

import httpx
import respx
from fastapi.testclient import TestClient

from skylens_api.jpl import SB_IDENT_URL, _dms, _hms, parse_dms, parse_hms, parse_sb_ident
from skylens_api.main import create_app

FIXTURE = json.loads((Path(__file__).parent / "fixtures_sb_ident.json").read_text())
EMPTY = {"signature": {}, "warning": "no matching records", "observer": {}}


def test_field_centre_is_formatted_for_jpl() -> None:
    assert _hms(180.0) == "12-00-00.00"
    assert _dms(-7.245147) == "M07-14-42.53"
    assert _dms(4.7394) == "04-44-21.84"


def test_sexagesimal_parsing_round_trips() -> None:
    assert round(parse_hms("12:00:19.26"), 5) == 180.08025
    assert round(parse_dms("-00 22'19.0\""), 5) == -0.37194
    assert round(parse_dms("+00 09'34.5\""), 5) == 0.15958


def test_second_pass_rows_become_small_bodies() -> None:
    bodies = parse_sb_ident(FIXTURE, "asteroid")
    assert [b.name for b in bodies] == ["8891 Irokawa (1994 RC1)", "11670 Fountain (1998 AU9)", "37946 (1998 HH20)"]
    assert bodies[0].vmag == 18.8
    assert bodies[0].ra_rate_arcsec_h == -10.52
    assert bodies[0].kind == "asteroid"
    assert parse_sb_ident(EMPTY, "comet") == []


@respx.mock
def test_solar_system_endpoint_merges_asteroids_and_comets() -> None:
    route = respx.get(SB_IDENT_URL).mock(
        side_effect=lambda request: httpx.Response(200, json=FIXTURE if request.url.params["sb-kind"] == "a" else EMPTY)
    )
    with TestClient(create_app()) as client:
        response = client.get("/api/v1/solar-system", params={"ra": 180, "dec": 0, "mjd": 60801.2, "size": 1})
        assert response.status_code == 200
        body = response.json()
        assert body["count"] == 3
        assert body["bodies"][0]["name"] == "11670 Fountain (1998 AU9)"  # brightest first
        assert route.call_count == 2
        sent = route.calls[0].request.url.params
        assert sent["obs-time"] == "2460801.700000"
        assert sent["fov-ra-hwidth"] == "0.5000"
        assert sent["mpc-code"] == "500"
        # second identical request is served from the cache
        client.get("/api/v1/solar-system", params={"ra": 180, "dec": 0, "mjd": 60801.2, "size": 1})
        assert route.call_count == 2
