# SkyLens API

FastAPI backend that talks to NASA/IPAC IRSA for SPHEREx data.

```bash
uv sync
uv run uvicorn skylens_api.main:app --reload   # http://localhost:8000/docs
uv run pytest && uv run ruff check . && uv run ruff format --check .
```
