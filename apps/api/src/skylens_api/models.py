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


class SpectralPoint(BaseModel):
    wavelength_um: float
    bandwidth_um: float
    flux: float = Field(description="Surface brightness at the position minus zodiacal light, in MJy/sr")
    error: float
    detector: int
    mjd: float
    obs_id: str


class SpectrumResponse(BaseModel):
    ra: float
    dec: float
    unit: str = "MJy/sr"
    n_images: int
    n_available: int
    n_saturated: int = Field(description="Samples dropped because the source saturates the detector")
    n_flagged: int = Field(description="Samples dropped because of other bad-pixel flags")
    points: list[SpectralPoint]


class SmallBody(BaseModel):
    name: str
    kind: str = Field(description="asteroid | comet")
    ra: float
    dec: float
    vmag: float | None = None
    ra_rate_arcsec_h: float | None = None
    dec_rate_arcsec_h: float | None = None
    dist_arcsec: float | None = None


class SmallBodiesResponse(BaseModel):
    ra: float
    dec: float
    size_deg: float
    mjd: float
    count: int
    bodies: list[SmallBody]
