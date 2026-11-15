import type { Observation } from './api';

export interface Epoch {
  index: number;
  mjdStart: number;
  mjdEnd: number;
  count: number;
  byDetector: Record<number, number>;
}

export function groupEpochs(observations: Observation[], gapDays = 30): Epoch[] {
  const ordered = [...observations].sort((a, b) => a.mjd_start - b.mjd_start || a.detector - b.detector);
  const groups: Observation[][] = [];
  for (const observation of ordered) {
    const current = groups[groups.length - 1];
    const lastMjd = current?.reduce((latest, item) => Math.max(latest, item.mjd_start), -Infinity) ?? -Infinity;
    if (!current || observation.mjd_start - lastMjd > gapDays) groups.push([observation]);
    else current.push(observation);
  }
  return groups.map((group, index) => {
    const byDetector = Object.fromEntries(Array.from({ length: 6 }, (_, position) => [position + 1, 0])) as Record<
      number,
      number
    >;
    for (const observation of group) byDetector[observation.detector] += 1;
    return {
      index,
      mjdStart: Math.min(...group.map((item) => item.mjd_start)),
      mjdEnd: Math.max(...group.map((item) => item.mjd_start)),
      count: group.length,
      byDetector,
    };
  });
}

export function mjdToDate(mjd: number): Date {
  return new Date((mjd - 40587) * 86400000);
}

interface DateParts {
  day: string;
  month: string;
  year: string;
}

function dateParts(mjd: number): DateParts {
  const parts = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(mjdToDate(mjd));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return { day: get('day'), month: get('month').replace('.', '').toLocaleLowerCase('es-AR'), year: get('year') };
}

export function formatEpochRange(start: number, end: number): string {
  const first = dateParts(start);
  const last = dateParts(end);
  if (first.year !== last.year) {
    return `${first.day} ${first.month} ${first.year} – ${last.day} ${last.month} ${last.year}`;
  }
  if (first.month !== last.month) {
    return `${first.day} ${first.month} – ${last.day} ${last.month} ${last.year}`;
  }
  return `${first.day}–${last.day} ${last.month} ${last.year}`;
}

export function formatEpochSummary(epochs: Epoch[]): string {
  if (!epochs.length) return '';
  const monthYear = (mjd: number) =>
    new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
      .format(mjdToDate(mjd))
      .replace('.', '')
      .toLocaleLowerCase('es-AR');
  const count = epochs.length === 1 ? '1 época' : `${epochs.length} épocas`;
  return `${count} · ${monthYear(epochs[0].mjdStart)} – ${monthYear(epochs[epochs.length - 1].mjdEnd)}`;
}
