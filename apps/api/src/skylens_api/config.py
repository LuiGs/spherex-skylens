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


@lru_cache
def get_settings() -> Settings:
    return Settings()
