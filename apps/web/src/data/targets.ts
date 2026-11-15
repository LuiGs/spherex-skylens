export interface Target {
  id: string;
  name: string;
  /** ICRS degrees at Julian-year `epoch`. */
  ra: number;
  dec: number;
  epoch: number;
  /** mas/year; pmRa includes cos(dec). */
  pmRa?: number;
  pmDec?: number;
  /** Milliarcseconds. */
  parallax?: number;
  source: string;
  fov: number;
  note: string;
}

/** Test targets requested by the Space Apps 2026 "Planet X and SPHEREx" challenge. */
export const CHALLENGE_TARGETS: Target[] = [
  {
    id: 'barnard',
    name: "Barnard's Star",
    ra: 269.44850252544,
    dec: 4.73942005111,
    epoch: 2016.0,
    pmRa: -801.551,
    pmDec: 10362.394,
    parallax: 546.9759,
    source: 'Gaia DR3 4472832130942575872',
    fov: 0.25,
    note: 'Highest proper motion star (~10"/yr).',
  },
  {
    id: 'eps-indi-b',
    name: 'Epsilon Indi B',
    ra: 331.07645259656,
    dec: -56.79381206688,
    epoch: 2016.0,
    pmRa: 3981.977,
    pmDec: -2466.832,
    parallax: 270.658,
    source: 'Gaia DR3 6412596012146801152',
    fov: 0.25,
    note: 'Pair of brown dwarfs orbiting Epsilon Indi.',
  },
  {
    id: 'wise-0855',
    name: 'WISE 0855−0714',
    ra: 133.7839831,
    dec: -7.2441961,
    epoch: 2015.401779603,
    pmRa: -7965.0,
    pmDec: 806.2,
    parallax: 449.0,
    source: 'CatWISE2020 J085508.34-071439.2',
    fov: 0.1,
    note: 'Coldest known brown dwarf, fast mover.',
  },
  {
    id: 'rw-aur',
    name: 'RW Aurigae',
    ra: 76.95654431103,
    dec: 30.40131614989,
    epoch: 2016.0,
    pmRa: 4.906,
    pmDec: -24.578,
    parallax: 5.4541,
    source: 'Gaia DR3 156430817820015232',
    fov: 0.2,
    note: 'Variable young star.',
  },
  {
    id: 'r-dra',
    name: 'R Draconis',
    ra: 248.16737836729,
    dec: 66.75500674547,
    epoch: 2016.0,
    pmRa: -20.643,
    pmDec: 6.149,
    parallax: 1.2509,
    source: 'Gaia DR3 1648328016354496384',
    fov: 0.2,
    note: 'Mira variable.',
  },
];
