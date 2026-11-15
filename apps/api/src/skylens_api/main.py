from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .irsa import IrsaClient
from .routers import observations, spectrum, timelapse


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.irsa = IrsaClient(get_settings())
    app.state.timelapse = timelapse.TimelapseService(app.state.irsa, get_settings())
    yield
    await app.state.irsa.aclose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="SPHEREx SkyLens API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.include_router(observations.router)
    app.include_router(timelapse.router)
    app.include_router(spectrum.router)

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
