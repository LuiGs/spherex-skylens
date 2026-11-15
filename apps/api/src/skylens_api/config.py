from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SKYLENS_", env_file=".env", extra="ignore")

    irsa_base_url: str = "https://irsa.ipac.caltech.edu"
    sia_collections: list[str] = ["spherex_dr1", "spherex_qr3"]
    http_timeout_s: float = 60.0
    http_retries: int = 3
    http_retry_backoff_s: float = 0.5
    cors_origins: list[str] = ["*"]
    timelapse_epoch_gap_days: float = 30.0
    timelapse_max_images_per_epoch: int = 12
    timelapse_max_concurrency: int = 4
    timelapse_pixel_scale_arcsec: float = 6.15
    timelapse_stretch_percentiles: tuple[float, float] = (0.5, 99.5)
    timelapse_bad_flags: list[str] = [
        "TRANSIENT",
        "OVERFLOW",
        "SUR_ERROR",
        "NONFUNC",
        "MISSING_DATA",
        "HOT",
        "COLD",
        "NONLINEAR",
        "PERSIST",
        "OUTLIER",
    ]
    search_cache_ttl_s: float = 3600.0
    cache_dir: str = "cache/cutouts"


@lru_cache
def get_settings() -> Settings:
    return Settings()
