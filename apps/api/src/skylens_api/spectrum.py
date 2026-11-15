"""Instant spectrum: one sample per SPHEREx image, read at the pixel that contains the position."""

from __future__ import annotations

import io
import math
import warnings

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS, FITSFixedWarning

from .models import Observation, SpectralPoint
from .timelapse import bad_flag_mask


def spread_observations(observations: list[Observation], limit: int) -> list[Observation]:
    """Up to `limit` observations, shared evenly between detectors and spread over time within each."""
    by_detector: dict[int, list[Observation]] = {}
    for observation in sorted(observations, key=lambda item: (item.mjd_start, item.obs_id)):
        by_detector.setdefault(observation.detector, []).append(observation)
    chosen: list[Observation] = []
    remaining = limit
    for position, (_, items) in enumerate(sorted(by_detector.items(), key=lambda pair: len(pair[1]))):
        quota = min(len(items), remaining // (len(by_detector) - position))
        if quota:
            step = len(items) / quota
            chosen += [items[int(index * step)] for index in range(quota)]
        remaining -= quota
    return sorted(chosen, key=lambda item: (item.detector, item.mjd_start))


SATURATION_FLAGS = ("OVERFLOW",)


def spectral_point(
    content: bytes, observation: Observation, ra: float, dec: float, bad_flag_names: list[str]
) -> SpectralPoint | str:
    """Sample (wavelength, flux) at (ra, dec) from a SPHEREx Level 2 cutout.

    Unusable pixels return the reason instead: "saturated", "flagged", "outside" or "invalid".
    """
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FITSFixedWarning)
        with fits.open(io.BytesIO(content), memmap=False) as hdus:
            if "WCS-WAVE" not in hdus:
                return "invalid"
            header = hdus["IMAGE"].header
            x, y = WCS(header).celestial.all_world2pix([[ra, dec]], 0)[0]
            column, row = int(round(x)), int(round(y))
            image = hdus["IMAGE"].data
            if not (0 <= row < image.shape[0] and 0 <= column < image.shape[1]):
                return "outside"
            flags = int(hdus["FLAGS"].data[row, column])
            if flags & bad_flag_mask(hdus["FLAGS"].header, list(SATURATION_FLAGS)):
                return "saturated"
            if flags & bad_flag_mask(hdus["FLAGS"].header, bad_flag_names):
                return "flagged"
            flux = float(image[row, column]) - float(hdus["ZODI"].data[row, column])
            variance = float(hdus["VARIANCE"].data[row, column])
            wavelength, bandwidth = WCS(header, fobj=hdus, key="W").all_pix2world([[column, row]], 0)[0]
    if not all(math.isfinite(value) for value in (flux, variance, wavelength, bandwidth)) or variance <= 0:
        return "invalid"
    return SpectralPoint(
        wavelength_um=float(wavelength),
        bandwidth_um=float(bandwidth),
        flux=flux,
        error=float(np.sqrt(variance)),
        detector=observation.detector,
        mjd=observation.mjd_start,
        obs_id=observation.obs_id,
    )
