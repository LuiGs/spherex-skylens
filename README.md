# SPHEREx SkyLens

> NASA Space Apps Challenge 2026 · **Planet X and SPHEREx**

Herramienta web pública para explorar el cielo infrarrojo de la misión **SPHEREx** (NASA) y ver
**cómo cambia con el tiempo**: apuntá tu celular al cielo y ves lo que SPHEREx ve en esa dirección, o
navegá desde la PC, ingresá coordenadas (RA/Dec) y reproducí las imágenes de distintas épocas como un video
para encontrar objetos en movimiento (enanas marrones, asteroides, cometas…).

## Funcionalidades (objetivo)

| Estado | Funcionalidad |
| --- | --- |
| ✅ | Visor del cielo SPHEREx DR1 (HiPS de IRSA, 102 bandas) con Aladin Lite |
| ✅ | Un canal monocromático o composición de un rango de canales en azul–verde–rojo según su longitud de onda |
| ✅ | Selector SIN/TAN y cuadrícula de coordenadas con niveles ligados al zoom y etiquetas en grados |
| ✅ | Búsqueda por RA/Dec (sexagesimal o decimal) y objetivos del challenge con movimiento propio |
| ✅ | Links compartibles `?ra=&dec=&fov=&frame=&projection=` |
| ✅ | Modo "apuntá el celular" (orientación + GPS + hora → RA/Dec) |
| ✅ | API: listado de imágenes SPHEREx por época/detector con URLs de cutout |
| 🚧 | Timelapse / blink de cutouts por época (el "video") |
| 🚧 | Coadd por detector D1–D6, resta de épocas, espectro instantáneo |
| 🚧 | Overlays Gaia DR3 / WISE, metadatos y flags de contaminación |
| 🚧 | Navegación PC por movimiento (teclado, gamepad, gestos) |

Roadmap detallado y reparto de trabajo: [docs/roadmap.md](docs/roadmap.md).

## Stack

- **apps/web** – Vite + React 19 + TypeScript, Aladin Lite v3 (WebGL/HiPS), PWA. Tests con Vitest.
- **apps/api** – Python 3.12, FastAPI, httpx, astropy. Gestionado con `uv`. Tests con pytest + respx, lint con ruff.
- **Infra** – Microsoft Azure (Global Offer de Space Apps): Static Web Apps (web) + Container Apps (API). Dominio vía GoDaddy, planificación en Miro. Ver [docs/deploy-azure.md](docs/deploy-azure.md).
- **Datos** – NASA/IPAC IRSA (SPHEREx DR1/QR3 vía SIA, HiPS y servicio de cutouts), Gaia DR3 vía CDS/VizieR.

Arquitectura: [docs/architecture.md](docs/architecture.md) · Fuentes de datos: [docs/data-sources.md](docs/data-sources.md)

## Empezar

Requisitos: Node 22 + pnpm 9, Python 3.12 + [uv](https://docs.astral.sh/uv/).

```bash
pnpm install                 # web
(cd apps/api && uv sync)     # api

pnpm dev:api                 # http://localhost:8000/docs
pnpm dev:web                 # http://localhost:5173 (proxy /api -> :8000)

pnpm lint && pnpm test && pnpm build
```

Ejemplos: [WISE 0855](http://localhost:5173/?ra=133.795129&dec=-7.245147&fov=0.2&frame=90) ·
API: `GET /api/v1/observations?ra=133.795129&dec=-7.245147&detector=3`

En **Capas → Luz infrarroja**, el switch alterna un canal **monocromático** con una composición de **varios canales
en color**. Elegí mínimo y máximo con los dos controles; se ajustan a los canales publicados y las flechas del
teclado avanzan de a uno. La tira inferior muestra D1–D6 y cada canal a su posición real en µm; los dos canales
sin datos aparecen rayados y se omiten. El azul corresponde al extremo de menor longitud de onda, el verde al
centro y el rojo al extremo mayor. El color se calcula por µm, no por número de canal. El rango y el modo quedan
en la URL (`mode=color&min=0&max=101`, índices de canal desde cero).

La API compone los tiles PNG de IRSA y los guarda en caché (volumen `spectral-cache` en Docker). Es una
composición para explorar visualmente, con normalización por componente RGB; las mediciones científicas deben
usar los FITS originales. Las longitudes de onda centrales se comparten entre web y API desde
`apps/api/src/skylens_api/spherex_channels.json`, tomadas de las propiedades oficiales del HiPS DR1.

En **Capas → Proyección del cielo**, elegí **SIN · mapa** o **TAN · perspectiva**. La elección se conserva en la URL.
La cuadrícula RA/Dec sigue la proyección, aparece al mover la cámara y se desvanece suavemente al detenerla,
incluso sin imágenes. Los niveles de detalle cambian
con el zoom mediante una transición suave; mover la vista no cambia el espaciado angular de los círculos.
Las etiquetas siguen la dirección de las curvas e indican AR y Dec en grados, sin ceros de relleno.
Hay un máximo de 14 etiquetas (8 de AR); los meridianos secundarios se interrumpen cerca del polo para evitar
que tapen las imágenes. El límite se reduce en pantallas pequeñas.
El arrastre con mouse conserva la orientación completa de la cámara al cruzar los polos. TAN limita el campo de visión a 170°
para evitar la singularidad de la perspectiva a 180°.

Al cambiar el rango o el modo espectral se prepara primero el tile central y su vista de menor resolución,
conservando la imagen anterior. Las selecciones obsoletas se cancelan. Si la carga falla, se reintenta automáticamente;
el nuevo intento utiliza una identidad de capa nueva para evitar reutilizar tiles fallidos de Aladin.

> El modo "apuntá el celular" requiere HTTPS (o `localhost`) para acceder a los sensores. Para probar en un
> teléfono en la misma red usá un túnel HTTPS (p. ej. `cloudflared tunnel --url http://localhost:5173`).

## Contribuir

Leé [CONTRIBUTING.md](CONTRIBUTING.md). Cada tarea vive en un issue; una rama y un PR por issue.

## Créditos

This publication makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of
Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California
Institute of Technology, and is funded by the National Aeronautics and Space Administration. Data served by NASA/IPAC
IRSA. Visualization powered by [Aladin Lite](https://aladin.cds.unistra.fr/) (CDS, Strasbourg). NASA does not endorse
this project.
