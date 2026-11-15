# SkyLens API

FastAPI backend that talks to NASA/IPAC IRSA for SPHEREx data.

```bash
uv sync
uv run uvicorn skylens_api.main:app --reload   # http://localhost:8000/docs
uv run pytest && uv run ruff check . && uv run ruff format --check .
```

## Timelapse

`GET /api/v1/timelapse?ra=133.795129&dec=-7.245147&size=0.05` returns metadata
for time-grouped SPHEREx cutouts. An optional `detector=1` limits the result to
one detector. Each epoch's `frame_url` returns an 8-bit grayscale PNG:

```bash
curl 'http://localhost:8000/api/v1/timelapse?ra=133.795129&dec=-7.245147&size=0.05'
curl 'http://localhost:8000/api/v1/timelapse/frame?ra=133.795129&dec=-7.245147&size=0.05&epoch=0' \
  --output frame.png
```

Timelapse cache and image processing can be tuned with `SKYLENS_TIMELAPSE_*`
settings; cutout files default to `cache/cutouts` and search results are cached
for `SKYLENS_SEARCH_CACHE_TTL_S` seconds.
