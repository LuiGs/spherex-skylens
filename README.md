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
| ✅ | Selector SIN/TAN y cuadrícula de coordenadas que aparece al navegar y se desvanece al detenerse |
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

En **Capas → Proyección del cielo**, elegí **SIN · mapa** o **TAN · perspectiva**. La elección se conserva en la URL.
La cuadrícula RA/Dec sigue la proyección y aparece al arrastrar, hacer zoom o apuntar con el celular; después se
desvanece al dejar de navegar, incluso si todavía no se cargaron las imágenes. TAN limita el campo de visión a 170°
para evitar la singularidad de la perspectiva a 180°.

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
