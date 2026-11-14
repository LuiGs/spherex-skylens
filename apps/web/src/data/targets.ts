export interface Target {
  id: string;
  name: string;
  /** J2000/ICRS degrees at `epoch`. */
  ra: number;
  dec: number;
  epoch: number;
  pmRa?: number;
  pmDec?: number;
  fov: number;
  note: string;
}

/** Test targets requested by the Space Apps 2026 "Planet X and SPHEREx" challenge. Coordinates are approximate (SIMBAD). */
export const CHALLENGE_TARGETS: Target[] = [
  {
    id: 'barnard',
    name: "Barnard's Star",
    ra: 269.452076,
    dec: 4.693364,
    epoch: 2000,
    pmRa: -801.551,
    pmDec: 10362.394,
    fov: 0.25,
    note: 'Highest proper motion star (~10"/yr).',
  },
  {
    id: 'eps-indi-b',
    name: 'Epsilon Indi B',
    ra: 331.043831,
    dec: -56.782674,
    epoch: 2000,
    pmRa: 3981,
    pmDec: -2466,
    fov: 0.25,
    note: 'Pair of brown dwarfs orbiting Epsilon Indi.',
  },
  {
    id: 'wise-0855',
    name: 'WISE 0855−0714',
    ra: 133.795129,
    dec: -7.245147,
    epoch: 2014,
    pmRa: -8118,
    pmDec: 673,
    fov: 0.1,
    note: 'Coldest known brown dwarf, fast mover.',
  },
  { id: 'rw-aur', name: 'RW Aurigae', ra: 76.956417, dec: 30.401417, epoch: 2000, fov: 0.2, note: 'Variable young star.' },
  { id: 'r-dra', name: 'R Draconis', ra: 248.167417, dec: 66.754889, epoch: 2000, fov: 0.2, note: 'Mira variable.' },
];
