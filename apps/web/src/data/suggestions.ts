export interface Suggestion {
  id: string;
  /** Display name per language. */
  name: { es: string; en: string };
  /** Extra names people type, in any language, without accents. */
  aliases: string[];
  /** ICRS J2000, degrees. */
  ra: number;
  dec: number;
  /** Field of view that frames the object well, degrees. */
  fov: number;
  kind: 'galaxy' | 'nebula' | 'cluster' | 'star' | 'region';
}

const s = (
  id: string,
  es: string,
  en: string,
  aliases: string[],
  ra: number,
  dec: number,
  fov: number,
  kind: Suggestion['kind'],
): Suggestion => ({ id, name: { es, en }, aliases, ra, dec, fov, kind });

/** Well-known places in the sky for people who do not know catalogue names. */
export const SUGGESTIONS: Suggestion[] = [
  s('m31', 'Galaxia de Andrómeda', 'Andromeda Galaxy', ['M31', 'NGC 224'], 10.6847, 41.2687, 3, 'galaxy'),
  s('m42', 'Nebulosa de Orión', 'Orion Nebula', ['M42', 'NGC 1976'], 83.8221, -5.3911, 1.5, 'nebula'),
  s('m45', 'Las Pléyades', 'The Pleiades', ['M45', 'Siete hermanas', 'Seven Sisters', 'Subaru'], 56.75, 24.1167, 2.5, 'cluster'),
  s('sirius', 'Sirio', 'Sirius', ['Alpha CMa', 'Dog Star'], 101.2872, -16.7161, 0.5, 'star'),
  s('betelgeuse', 'Betelgeuse', 'Betelgeuse', ['Alpha Ori'], 88.7929, 7.4071, 0.5, 'star'),
  s('polaris', 'Estrella Polar', 'Polaris', ['North Star', 'Alpha UMi'], 37.9546, 89.2641, 0.5, 'star'),
  s('vega', 'Vega', 'Vega', ['Alpha Lyr'], 279.2347, 38.7837, 0.5, 'star'),
  s('antares', 'Antares', 'Antares', ['Alpha Sco'], 247.3519, -26.432, 0.5, 'star'),
  s('alphacen', 'Alfa Centauri', 'Alpha Centauri', ['Rigil Kentaurus', 'Alpha Cen'], 219.9021, -60.834, 0.5, 'star'),
  s('proxima', 'Próxima Centauri', 'Proxima Centauri', ['Proxima'], 217.4289, -62.6795, 0.5, 'star'),
  s('sgra', 'Centro de la Vía Láctea', 'Galactic Centre', ['Sgr A*', 'Sagittarius A', 'Milky Way center'], 266.4168, -29.0078, 3, 'region'),
  s('lmc', 'Gran Nube de Magallanes', 'Large Magellanic Cloud', ['LMC'], 80.8942, -69.7561, 8, 'galaxy'),
  s('smc', 'Pequeña Nube de Magallanes', 'Small Magellanic Cloud', ['SMC'], 13.1583, -72.8003, 5, 'galaxy'),
  s('m1', 'Nebulosa del Cangrejo', 'Crab Nebula', ['M1', 'NGC 1952'], 83.6331, 22.0145, 0.5, 'nebula'),
  s('m104', 'Galaxia del Sombrero', 'Sombrero Galaxy', ['M104', 'NGC 4594'], 189.9976, -11.6231, 0.8, 'galaxy'),
  s('m51', 'Galaxia del Remolino', 'Whirlpool Galaxy', ['M51', 'NGC 5194'], 202.4696, 47.1952, 0.8, 'galaxy'),
  s('m57', 'Nebulosa del Anillo', 'Ring Nebula', ['M57', 'NGC 6720'], 283.3963, 33.0292, 0.4, 'nebula'),
  s('m8', 'Nebulosa de la Laguna', 'Lagoon Nebula', ['M8', 'NGC 6523'], 270.9208, -24.3867, 1.5, 'nebula'),
  s('m20', 'Nebulosa Trífida', 'Trifid Nebula', ['M20', 'NGC 6514'], 270.6333, -23.03, 1, 'nebula'),
  s('m16', 'Nebulosa del Águila', 'Eagle Nebula', ['M16', 'NGC 6611', 'Pillars of Creation', 'Pilares de la Creacion'], 274.7, -13.8067, 1, 'nebula'),
  s('m13', 'Gran Cúmulo de Hércules', 'Great Hercules Cluster', ['M13', 'NGC 6205'], 250.4235, 36.4613, 0.8, 'cluster'),
  s('omegacen', 'Omega Centauri', 'Omega Centauri', ['NGC 5139'], 201.697, -47.4795, 1, 'cluster'),
  s('trappist1', 'TRAPPIST-1', 'TRAPPIST-1', ['Trappist'], 346.6224, -5.0414, 0.5, 'star'),
  s('wolf359', 'Wolf 359', 'Wolf 359', [], 164.1203, 7.0147, 0.5, 'star'),
  s('teegarden', 'Estrella de Teegarden', "Teegarden's Star", ['Teegarden'], 43.254, 16.881, 0.5, 'star'),
];
