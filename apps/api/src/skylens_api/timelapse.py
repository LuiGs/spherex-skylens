"""Pure epoch selection, reprojection, coaddition, and image-stretch logic."""

from __future__ import annotations

import io
import re
from dataclasses import dataclass

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
from PIL import Image
from reproject import reproject_interp
from scipy import ndimage

from .models import Observation

_DEFAULT_BAD_BITS = (0, 1, 2, 6, 9, 10, 11, 15, 17, 19)
_MASK_NAME_RE = re.compile(r"MSKN(\d{4})$")


@dataclass(frozen=True)
class EpochGroup:
    observations: tuple[Observation, ...]
    mjd_start: float
    mjd_end: float

    @property
    def mjd_mid(self) -> float:
        return (self.mjd_start + self.mjd_end) / 2


@dataclass(frozen=True)
class SelectedEpoch:
    group: EpochGroup
    observations: tuple[Observation, ...]


def group_epochs(observations: list[Observation], gap_days: float) -> list[EpochGroup]:
    ordered = sorted(observations, key=lambda item: (item.mjd_start, item.detector, item.obs_id))
    grouped: list[list[Observation]] = []
    for observation in ordered:
        if not grouped or observation.mjd_start - max(item.mjd_end for item in grouped[-1]) > gap_days:
            grouped.append([observation])
        else:
            grouped[-1].append(observation)
    return [
        EpochGroup(
            observations=tuple(group),
            mjd_start=min(item.mjd_start for item in group),
            mjd_end=max(item.mjd_end for item in group),
        )
        for group in grouped
    ]


def select_epoch_images(
    observations: list[Observation], max_images: int, gap_days: float = 30.0
) -> list[SelectedEpoch]:
    selected: list[SelectedEpoch] = []
    for group in group_epochs(observations, gap_days=gap_days):
        by_detector: dict[int, list[Observation]] = {}
        for observation in group.observations:
            by_detector.setdefault(observation.detector, []).append(observation)
        queues = {detector: list(items) for detector, items in sorted(by_detector.items())}
        chosen: list[Observation] = []
        while len(chosen) < max_images and any(queues.values()):
            for detector in queues:
                if queues[detector] and len(chosen) < max_images:
                    chosen.append(queues[detector].pop(0))
        chosen.sort(key=lambda item: (item.mjd_start, item.detector, item.obs_id))
        selected.append(SelectedEpoch(group=group, observations=tuple(chosen)))
    return selected


def bad_flag_mask(header: fits.Header, bad_flag_names: list[str]) -> int:
    name_values: dict[str, int] = {}
    for key, name in header.items():
        match = _MASK_NAME_RE.fullmatch(key)
        if match:
            mask = header.get(f"MSKM{match.group(1)}")
            if mask is not None:
                name_values[str(name).upper()] = int(mask)
    if name_values:
        return sum(mask for name, mask in name_values.items() if name in {item.upper() for item in bad_flag_names})
    return sum(1 << bit for bit in _DEFAULT_BAD_BITS)


def target_wcs(ra: float, dec: float, size_deg: float, pixel_scale_arcsec: float) -> tuple[WCS, int]:
    pixels = max(1, int(np.ceil(size_deg * 3600 / pixel_scale_arcsec)))
    wcs = WCS(naxis=2)
    wcs.wcs.crpix = [(pixels + 1) / 2, (pixels + 1) / 2]
    wcs.wcs.crval = [ra, dec]
    wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    wcs.wcs.cdelt = [-pixel_scale_arcsec / 3600, pixel_scale_arcsec / 3600]
    return wcs, pixels


def coadd_fits(
    cutouts: list[bytes],
    ra: float,
    dec: float,
    size_deg: float,
    pixel_scale_arcsec: float,
    bad_flag_names: list[str],
) -> np.ndarray:
    output_wcs, pixels = target_wcs(ra, dec, size_deg, pixel_scale_arcsec)
    weighted_sum = np.zeros((pixels, pixels), dtype=np.float64)
    weight_sum = np.zeros((pixels, pixels), dtype=np.float64)

    for content in cutouts:
        with fits.open(io.BytesIO(content), memmap=False) as hdus:
            image_hdu = hdus["IMAGE"]
            flags_hdu = hdus["FLAGS"]
            variance_hdu = hdus["VARIANCE"]
            zodiacal_hdu = hdus["ZODI"]
            image = np.asarray(image_hdu.data, dtype=np.float64) - np.asarray(zodiacal_hdu.data, dtype=np.float64)
            variance = np.asarray(variance_hdu.data, dtype=np.float64).copy()
            flags = np.asarray(flags_hdu.data)
            mask = bad_flag_mask(flags_hdu.header, bad_flag_names)
            invalid = (flags & mask) != 0
            image[invalid] = np.nan
            variance[invalid] = np.nan
            variance[~np.isfinite(variance) | (variance <= 0)] = np.nan
            source_wcs = WCS(image_hdu.header).celestial
            projected, footprint = reproject_interp(
                (image, source_wcs), output_wcs, shape_out=(pixels, pixels), return_footprint=True
            )
            projected_variance = reproject_interp((variance, source_wcs), output_wcs, shape_out=(pixels, pixels))[0]
            valid = (
                (footprint > 0) & np.isfinite(projected) & np.isfinite(projected_variance) & (projected_variance > 0)
            )
            weights = np.zeros_like(projected, dtype=np.float64)
            weights[valid] = 1 / projected_variance[valid]
            weighted_sum[valid] += projected[valid] * weights[valid]
            weight_sum[valid] += weights[valid]

    coadd = np.full((pixels, pixels), np.nan, dtype=np.float64)
    valid = weight_sum > 0
    coadd[valid] = weighted_sum[valid] / weight_sum[valid]
    return coadd


def shared_stretch(coadds: list[np.ndarray], percentiles: tuple[float, float]) -> tuple[float, float]:
    values = [array[np.isfinite(array)] for array in coadds if np.isfinite(array).any()]
    if not values:
        return 0.0, 1.0
    low, high = np.percentile(np.concatenate(values), percentiles)
    if not np.isfinite(low) or not np.isfinite(high) or high <= low:
        return float(low), float(low + 1)
    return float(low), float(high)


def fill_holes(data: np.ndarray) -> np.ndarray:
    """Fill masked pixels enclosed by valid ones (e.g. saturated star cores) with their brightest neighbour.

    Blank areas touching the border are real gaps in coverage and stay empty.
    """
    missing = ~np.isfinite(data)
    labels, count = ndimage.label(missing)
    if not count:
        return data
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    holes = missing & ~np.isin(labels, border)
    filled = data.copy()
    while holes.any():
        neighbours = ndimage.maximum_filter(np.where(np.isfinite(filled), filled, -np.inf), size=3)
        reachable = holes & np.isfinite(neighbours)
        if not reachable.any():
            break
        filled[reachable] = neighbours[reachable]
        holes &= ~reachable
    return filled


def render_png(data: np.ndarray, vmin: float, vmax: float) -> bytes:
    if not np.isfinite(vmin) or not np.isfinite(vmax) or vmax <= vmin:
        vmin, vmax = 0.0, 1.0
    data = fill_holes(data)
    normalized = np.clip((data - vmin) / (vmax - vmin), 0, 1)
    stretched = np.arcsinh(10 * normalized) / np.arcsinh(10)
    pixels = np.where(np.isfinite(stretched), stretched * 255, 0).astype(np.uint8)
    image = Image.fromarray(np.flipud(pixels), mode="L")
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()
