import { createContext, useContext } from 'react';

export type Lang = 'es' | 'en';
export const LANGS: Lang[] = ['es', 'en'];
const STORAGE_KEY = 'skylens:lang';

const es = {
  locale: 'es-AR',
  appDescription: 'Explorá el cielo infrarrojo de SPHEREx (NASA) desde tu celular o PC.',
  switchTo: 'English',
  help: 'Cómo se usa',
  tabs: { search: 'Buscar', observations: 'Observaciones', layers: 'Capas', label: 'Controles del mapa' },
  summary: { loading: 'Buscando observaciones…', empty: 'Sin observaciones', error: 'Observaciones no disponibles' },
  search: {
    label: 'Buscar un objeto por nombre o coordenadas',
    go: 'Ir',
    notFound: (q: string) => `No encontré “${q}”. Probá con otro nombre o con coordenadas RA Dec.`,
    resolverDown: 'No se pudo consultar el buscador de nombres (CDS). Probá con coordenadas RA Dec.',
  },
  targets: { label: 'Objetivos del challenge', placeholder: 'Elegí un objeto…' },
  expected: 'Posición esperada',
  moves: '▶ Ver si se mueve',
  spectrum: 'Espectro',
  spectrumHere: 'Espectro en el centro',
  clearMarker: 'Quitar marcador',
  keys: { move: 'o flechas para moverte', zoom: 'zoom', or: 'o' },
  band: (band: number, channel: number, um: string) => `Banda D${band} · canal ${channel} · ~${um} µm`,
  projection: {
    title: 'Proyección del cielo',
    sin: 'SIN · mapa',
    sinHint: 'SIN: mapa ortográfico del cielo',
    tan: 'TAN · perspectiva',
    tanHint: 'TAN: perspectiva desde el observador',
  },
  spectral: {
    title: 'Luz infrarroja',
    one: 'Un canal',
    many: 'Varios canales',
    minimum: 'Mínimo',
    maximum: 'Máximo',
    channelTitle: 'Canal',
    channel: 'canal',
    micrometers: 'micrómetros',
    noData: 'sin datos',
    strip: 'Bandas y canales por longitud de onda',
    bands: 'Bandas incluidas',
    loading: 'Cargando imágenes…',
    waiting: 'Esperando imágenes…',
  },
  gaia: (shown: boolean) => `${shown ? 'Ocultar' : 'Mostrar'} Gaia DR3`,
  ar: (active: boolean): string => (active ? 'Detener modo AR' : 'Modo AR: apuntar con el celular'),
  sensors: (status: string) => `Sensores no disponibles (${status}). Usá HTTPS y permití ubicación/orientación.`,
  errors: {
    busy: 'IRSA (el archivo de la NASA) está ocupado. Probá de nuevo en unos segundos.',
    network: 'No se pudo conectar con la API. Revisá tu conexión e intentá de nuevo.',
    http: (status?: number) => `La API respondió con estado ${status ?? '?'}.`,
    retry: 'Reintentar',
  },
  observations: {
    title: 'Observaciones SPHEREx',
    loading: 'Buscando observaciones…',
    emptyTitle: 'Sin observaciones',
    emptyBody: 'SPHEREx todavía no publicó imágenes de esta zona. Probá otro punto o uno de los objetivos.',
    busyTitle: 'IRSA está ocupado',
    busyBody: 'El archivo de la NASA no respondió (502/503). Los datos no se perdieron: probá de nuevo en unos segundos.',
    apiTitle: 'No se pudo conectar con la API',
    timelapse: (n: number) => `▶ Ver timelapse de ${n} épocas`,
    epoch: (n: number) => `Época ${n}`,
    images: (n: number) => `${n} ${n === 1 ? 'imagen' : 'imágenes'}`,
    epochs: (n: number) => (n === 1 ? '1 época' : `${n} épocas`),
  },
  timelapse: {
    title: 'Timelapse SPHEREx',
    close: 'Cerrar timelapse',
    side: 'de lado',
    sizes: { 0.03: 'Chico', 0.06: 'Medio', 0.1: 'Grande' } as Record<number, string>,
    loading: (s: number) => `Combinando las imágenes de SPHEREx de cada época… ${s} s`,
    loadingHint: (s: number) => `La primera vez tarda unos ${s} s; después queda en caché.`,
    empty: 'SPHEREx todavía no tiene imágenes de esta zona. Probá con uno de los objetivos del challenge.',
    frameError: 'No se pudo cargar un frame del timelapse.',
    diffError: 'No se pudo calcular la resta en este navegador.',
    modes: {
      play: { label: 'Animación', hint: 'Recorre todas las épocas en orden.' },
      blink: { label: 'Parpadeo', hint: 'Alterna la primera y la última época, como WiseView.' },
      diff: { label: 'Resta', hint: 'Última menos primera: lo que se movió aparece como un par claro/oscuro.' },
    },
    modeLabel: 'Modo',
    epochOf: (i: number, n: number) => `Época ${i} de ${n}`,
    lastMinusFirst: 'Última − primera',
    images: (n: number) => `${n} imágenes`,
    play: 'Reproducir',
    pause: 'Pausar',
    epoch: 'Época',
    speed: 'Velocidad',
    cutout: 'Recorte',
    detector: 'Detector',
    allDetectors: 'Todos (D1–D6)',
    hint: 'Las estrellas lejanas quedan quietas entre épocas: si algo cambia de lugar, se está moviendo.',
    markerHint: (name: string) => ` El círculo naranja marca dónde debería estar ${name} en cada época.`,
    compass: 'N↑ E←',
  },
  spectrumPanel: {
    title: 'Espectro SPHEREx',
    close: 'Cerrar espectro',
    loading: (s: number) => `Leyendo un píxel de cada foto de SPHEREx… ${s} s`,
    loadingHint: 'Unas 60 imágenes de los 6 detectores; la primera vez tarda ~30 s.',
    saturated:
      'Este objeto es tan brillante que satura el detector de SPHEREx (está pensado para objetos débiles), así que no se puede medir su espectro. Probá con un objeto más tenue.',
    empty: 'No hay imágenes de SPHEREx utilizables en este punto todavía.',
    chartLabel: (n: number) => `Espectro con ${n} mediciones entre 0.75 y 5 micrones`,
    caption: (points: number, images: number, available: number) =>
      `${points} mediciones de ${images} imágenes · brillo en MJy/sr sin luz zodiacal · ${available} imágenes disponibles en IRSA`,
    droppedSaturated: (n: number) => ` · ${n} descartadas por saturación`,
    explain:
      'Cada punto es una foto distinta: SPHEREx tiene filtros que cambian de color a lo largo del detector, así que cada vez que pasa, el objeto cae en otra longitud de onda. Juntando las fotos se arma el espectro, la “huella química” del objeto: las caídas marcan moléculas como agua (H₂O) o metano (CH₄), típicas de enanas marrones.',
  },
  onboarding: {
    steps: [
      {
        title: 'El cielo infrarrojo de SPHEREx',
        body: 'SPHEREx es un telescopio de la NASA que mapea todo el cielo en 102 colores infrarrojos, invisibles para el ojo. Acá ves sus imágenes reales, servidas por NASA/IPAC IRSA.',
      },
      {
        title: 'Movete por el cielo',
        body: 'Arrastrá para moverte y usá la rueda o el pellizco para hacer zoom. En PC también podés usar W A S D o las flechas, y + / − para el zoom. En el celular, activá el modo AR y apuntá el teléfono al cielo.',
      },
      {
        title: 'Encontrá lo que se mueve',
        body: 'Las estrellas lejanas parecen fijas; las enanas marrones cercanas o un posible “Planeta X” cambian de lugar entre las pasadas de SPHEREx. Elegí un objetivo del challenge y tocá “Ver si se mueve” para comparar las épocas.',
      },
    ],
    skip: 'Saltar',
    back: 'Atrás',
    next: 'Siguiente',
    start: 'Empezar a explorar',
  },
};

export type Messages = typeof es;

const en: Messages = {
  locale: 'en-US',
  appDescription: "Explore NASA SPHEREx's infrared sky from your phone or PC.",
  switchTo: 'Español',
  help: 'How it works',
  tabs: { search: 'Search', observations: 'Observations', layers: 'Layers', label: 'Map controls' },
  summary: { loading: 'Looking for observations…', empty: 'No observations', error: 'Observations unavailable' },
  search: {
    label: 'Search an object by name or coordinates',
    go: 'Go',
    notFound: (q: string) => `Couldn't find “${q}”. Try another name or RA Dec coordinates.`,
    resolverDown: 'The name resolver (CDS) is not responding. Try RA Dec coordinates.',
  },
  targets: { label: 'Challenge targets', placeholder: 'Pick an object…' },
  expected: 'Expected position',
  moves: '▶ Does it move?',
  spectrum: 'Spectrum',
  spectrumHere: 'Spectrum at center',
  clearMarker: 'Remove marker',
  keys: { move: 'or arrows to move', zoom: 'zoom', or: 'or' },
  band: (band: number, channel: number, um: string) => `Band D${band} · channel ${channel} · ~${um} µm`,
  projection: {
    title: 'Sky projection',
    sin: 'SIN · map',
    sinHint: 'SIN: orthographic sky map',
    tan: 'TAN · perspective',
    tanHint: 'TAN: perspective from the observer',
  },
  spectral: {
    title: 'Infrared light',
    one: 'One channel',
    many: 'Multiple channels',
    minimum: 'Minimum',
    maximum: 'Maximum',
    channelTitle: 'Channel',
    channel: 'channel',
    micrometers: 'micrometers',
    noData: 'no data',
    strip: 'Bands and channels by wavelength',
    bands: 'Included bands',
    loading: 'Loading images…',
    waiting: 'Waiting for images…',
  },
  gaia: (shown: boolean) => `${shown ? 'Hide' : 'Show'} Gaia DR3`,
  ar: (active: boolean) => (active ? 'Stop AR mode' : 'AR mode: point your phone'),
  sensors: (status: string) => `Sensors unavailable (${status}). Use HTTPS and allow location/orientation.`,
  errors: {
    busy: 'IRSA (the NASA archive) is busy. Try again in a few seconds.',
    network: 'Could not reach the API. Check your connection and try again.',
    http: (status?: number) => `The API answered with status ${status ?? '?'}.`,
    retry: 'Retry',
  },
  observations: {
    title: 'SPHEREx observations',
    loading: 'Looking for observations…',
    emptyTitle: 'No observations',
    emptyBody: 'SPHEREx has not released images of this area yet. Try another spot or one of the targets.',
    busyTitle: 'IRSA is busy',
    busyBody: 'The NASA archive did not answer (502/503). Nothing is lost: try again in a few seconds.',
    apiTitle: 'Could not reach the API',
    timelapse: (n: number) => `▶ Play ${n}-epoch timelapse`,
    epoch: (n: number) => `Epoch ${n}`,
    images: (n: number) => `${n} ${n === 1 ? 'image' : 'images'}`,
    epochs: (n: number) => (n === 1 ? '1 epoch' : `${n} epochs`),
  },
  timelapse: {
    title: 'SPHEREx timelapse',
    close: 'Close timelapse',
    side: 'wide',
    sizes: { 0.03: 'Small', 0.06: 'Medium', 0.1: 'Large' },
    loading: (s: number) => `Stacking the SPHEREx images of each epoch… ${s} s`,
    loadingHint: (s: number) => `The first time takes about ${s} s; then it is cached.`,
    empty: 'SPHEREx has no images of this area yet. Try one of the challenge targets.',
    frameError: 'Could not load a timelapse frame.',
    diffError: 'This browser could not compute the difference.',
    modes: {
      play: { label: 'Animate', hint: 'Steps through every epoch in order.' },
      blink: { label: 'Blink', hint: 'Alternates the first and last epochs, like WiseView.' },
      diff: { label: 'Difference', hint: 'Last minus first: anything that moved shows up as a bright/dark pair.' },
    },
    modeLabel: 'Mode',
    epochOf: (i: number, n: number) => `Epoch ${i} of ${n}`,
    lastMinusFirst: 'Last − first',
    images: (n: number) => `${n} images`,
    play: 'Play',
    pause: 'Pause',
    epoch: 'Epoch',
    speed: 'Speed',
    cutout: 'Cutout',
    detector: 'Detector',
    allDetectors: 'All (D1–D6)',
    hint: 'Distant stars stay put between epochs: if something changes place, it is moving.',
    markerHint: (name: string) => ` The orange circle marks where ${name} should be at each epoch.`,
    compass: 'N↑ E←',
  },
  spectrumPanel: {
    title: 'SPHEREx spectrum',
    close: 'Close spectrum',
    loading: (s: number) => `Reading one pixel from each SPHEREx image… ${s} s`,
    loadingHint: 'About 60 images from the 6 detectors; the first time takes ~30 s.',
    saturated:
      'This object is so bright that it saturates the SPHEREx detector (built for faint targets), so its spectrum cannot be measured. Try a fainter object.',
    empty: 'There are no usable SPHEREx images at this spot yet.',
    chartLabel: (n: number) => `Spectrum with ${n} measurements between 0.75 and 5 microns`,
    caption: (points: number, images: number, available: number) =>
      `${points} measurements from ${images} images · surface brightness in MJy/sr without zodiacal light · ${available} images available at IRSA`,
    droppedSaturated: (n: number) => ` · ${n} dropped as saturated`,
    explain:
      'Each dot is a different image: SPHEREx filters change color across the detector, so on every pass the object lands on a different wavelength. Putting the images together builds the spectrum, the object’s “chemical fingerprint”: dips mark molecules such as water (H₂O) or methane (CH₄), typical of brown dwarfs.',
  },
  onboarding: {
    steps: [
      {
        title: "SPHEREx's infrared sky",
        body: 'SPHEREx is a NASA telescope that maps the whole sky in 102 infrared colors, invisible to the eye. These are its real images, served by NASA/IPAC IRSA.',
      },
      {
        title: 'Move around the sky',
        body: 'Drag to move and use the wheel or pinch to zoom. On a PC you can also use W A S D or the arrows, and + / − to zoom. On a phone, turn on AR mode and point it at the sky.',
      },
      {
        title: 'Find what moves',
        body: 'Distant stars look fixed; nearby brown dwarfs or a possible “Planet X” change place between SPHEREx passes. Pick a challenge target and tap “Does it move?” to compare the epochs.',
      },
    ],
    skip: 'Skip',
    back: 'Back',
    next: 'Next',
    start: 'Start exploring',
  },
};

export const MESSAGES: Record<Lang, Messages> = { es, en };

export function detectLang(search: string, stored: string | null, browser: readonly string[]): Lang {
  const fromUrl = new URLSearchParams(search).get('lang');
  for (const candidate of [fromUrl, stored, ...browser.map((value) => value.slice(0, 2))]) {
    if (candidate === 'es' || candidate === 'en') return candidate;
  }
  return 'es';
}

export function initialLang(): Lang {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  return detectLang(window.location.search, stored, navigator.languages ?? [navigator.language]);
}

export function storeLang(lang: Lang): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Not persisted in private mode.
  }
}

export const I18nContext = createContext<{ lang: Lang; t: Messages; setLang: (lang: Lang) => void }>({
  lang: 'es',
  t: es,
  setLang: () => {},
});

export const useI18n = () => useContext(I18nContext);
