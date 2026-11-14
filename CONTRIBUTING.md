# Cómo contribuir

Guía para contribuir a SPHEREx SkyLens.

## Flujo de trabajo

1. Cada unidad de trabajo es un **issue** con criterios de aceptación. Tomalo asignándotelo o comentando.
2. Rama: `<tipo>/<issue>-<slug>` (p. ej. `feat/12-timelapse-player`). Un PR por issue, con `Closes #N`.
3. PRs chicos y enfocados. No mezclar refactors con features.
4. Antes de pedir review, todo en verde localmente:
   - web: `cd apps/web && pnpm lint && pnpm test && pnpm build`
   - api: `cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run pytest`
5. CI (GitHub Actions) debe pasar. No mergear a `main` sin review de al menos una persona del equipo.

## Estructura

```
apps/web    Frontend (Vite + React + TS + Aladin Lite)
  src/lib         Lógica pura y testeable (astro, url state, constantes SPHEREx)
  src/hooks       Hooks (sensores del celular, etc.)
  src/components  UI
  src/data        Datos estáticos (objetivos del challenge)
apps/api    Backend (FastAPI)
  src/skylens_api/irsa.py     Cliente IRSA (SIA, cutouts)
  src/skylens_api/routers/    Endpoints /api/v1/*
docs/       Arquitectura, fuentes de datos, roadmap
```

## Convenciones

- TypeScript estricto; lógica astronómica en `src/lib` con tests Vitest. Componentes sin lógica de cálculo.
- Python: tipado completo, `ruff` (line-length 120). Nada de llamadas reales a IRSA en tests: mockear con `respx`.
- Coordenadas siempre en **grados ICRS** dentro del código; formatos sexagesimales solo en la UI.
- Las versiones de datos de SPHEREx (DR1, QR3, …) son **configuración** (`SKYLENS_SIA_COLLECTIONS`, `SPHEREX_HIPS_URL`),
  nunca hardcodeadas en lógica: llegan releases nuevos seguido.
- IRSA responde 502/503 de forma intermitente: todo acceso remoto pasa por el cliente con reintentos y caché.
- UI en español primero (i18n más adelante), mobile-first, accesible (aria-labels, contraste).
- No commitear FITS, secretos ni `.env`.
