import pytest

from skylens_api.config import get_settings


@pytest.fixture(autouse=True)
def no_warm_up(monkeypatch: pytest.MonkeyPatch):
    """Keeps the start-up warm-up from reaching IRSA during tests."""
    monkeypatch.setenv("SKYLENS_WARM_POSITIONS", "[]")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
