import { describe, expect, it } from 'vitest';
import type { Observation } from './api';
import { formatEpochRange, groupEpochs, mjdToDate } from './epochs';

function observation(mjd: number, detector = 1): Observation {
  return {
    obs_id: `${detector}-${mjd}`,
    collection: 'spherex_dr1',
    detector,
    mjd_start: mjd,
    wavelength_min_um: 1,
    wavelength_max_um: 2,
    access_url: '',
    cutout_url: '',
  };
}

function toMjd(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime() / 86400000 + 40587;
}

describe('groupEpochs', () => {
  it('sorts observations, splits gaps, and counts detectors', () => {
    const epochs = groupEpochs([observation(65, 2), observation(2, 1), observation(10, 1), observation(66, 6)]);

    expect(epochs).toHaveLength(2);
    expect(epochs[0]).toMatchObject({ index: 0, mjdStart: 2, mjdEnd: 10, count: 2 });
    expect(epochs[0].byDetector).toEqual({ 1: 2, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
    expect(epochs[1]).toMatchObject({ index: 1, count: 2 });
    expect(epochs[1].byDetector[2]).toBe(1);
    expect(epochs[1].byDetector[6]).toBe(1);
  });
});

describe('epoch dates', () => {
  it('converts MJD to UTC', () => {
    expect(mjdToDate(60800.700028).toISOString()).toBe('2025-05-05T16:48:02.419Z');
  });

  it('formats same-month, same-year different-month, and cross-year ranges in Argentine Spanish', () => {
    expect(formatEpochRange(toMjd('2025-05-05'), toMjd('2025-05-06'))).toBe('05–06 may 2025');
    expect(formatEpochRange(toMjd('2025-10-31'), toMjd('2025-12-13'))).toBe('31 oct – 13 dic 2025');
    expect(formatEpochRange(toMjd('2025-12-31'), toMjd('2026-01-02'))).toBe('31 dic 2025 – 02 ene 2026');
  });
});
