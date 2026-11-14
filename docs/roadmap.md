# Roadmap y workstreams

Cada workstream se divide en issues en GitHub (labels `area:*`, milestones M1–M3). Están pensados para trabajarse en
paralelo, por distintas personas del equipo, con interfaces claras entre sí.

## Milestones

- **M1 · MVP del challenge** – coordenadas → serie de imágenes tipo video para los 5 objetivos de prueba.
- **M2 · Experiencia móvil y PC** – AR con el celular pulido, navegación por movimiento en PC, PWA.
- **M3 · Descubrimiento** – coadds, restas, espectros, overlays, metadatos, despliegue público.

## Workstreams

| Área | Descripción | Interfaz |
| --- | --- | --- |
| `area:api-timelapse` | Descargar cutouts por época, reproyectar a grilla común, normalizar y devolver frames PNG/WebP + GIF/MP4 | `GET /api/v1/timelapse` |
| `area:api-science` | Coadd por detector D1–D6, resta de épocas, espectro en un píxel/apertura | `GET /api/v1/coadd`, `/difference`, `/spectrum` |
| `area:api-infra` | Caché, rate limit hacia IRSA, deduplicar DR1/QR3, precarga de objetivos, deploy | interno |
| `area:web-player` | Reproductor timelapse/blink (play, velocidad, época, resta), integrado con Aladin | consume `/timelapse` |
| `area:web-mobile` | AR con el celular: calibración, suavizado, vista de cámara de fondo, PWA instalable | `useSkyPointing` |
| `area:web-desktop` | Navegación por movimiento en PC (teclado/gamepad/gestos), minimapa, onboarding | `SkyView` |
| `area:web-overlays` | Gaia DR3, WISE, metadatos/flags, panel de espectro | consume `/spectrum` |
| `area:devops` | CI/CD, Azure Static Web Apps + Container Apps, preview por PR, dominio GoDaddy | GitHub Actions |
