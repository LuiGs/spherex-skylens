from pydantic import BaseModel, Field


class Observation(BaseModel):
    obs_id: str
    collection: str
    detector: int = Field(ge=1, le=6, description="SPHEREx detector / band D1..D6")
    mjd_start: float
    mjd_end: float
    wavelength_min_um: float
    wavelength_max_um: float
    access_url: str
    cutout_url: str


class ObservationsResponse(BaseModel):
    ra: float
    dec: float
    size_deg: float
    count: int
    observations: list[Observation]


class TimelapseEpoch(BaseModel):
    index: int
    mjd_start: float
    mjd_end: float
    mjd_mid: float
    n_images: int
    n_available: int
    detectors: list[int]
    frame_url: str


class TimelapseStretch(BaseModel):
    kind: str = "asinh"
    vmin: float
    vmax: float


class TimelapseResponse(BaseModel):
    ra: float
    dec: float
    size_deg: float
    detector: int | None
    collections: list[str]
    pixel_scale_arcsec: float
    width: int
    height: int
    stretch: TimelapseStretch
    epochs: list[TimelapseEpoch]
