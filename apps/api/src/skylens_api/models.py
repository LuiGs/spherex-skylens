from pydantic import BaseModel, Field


class Observation(BaseModel):
    obs_id: str
    collection: str
    detector: int = Field(ge=1, le=6, description="SPHEREx detector / band D1..D6")
    mjd_start: float
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
