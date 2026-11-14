# Fuentes de datos

| Fuente | Uso | Acceso |
| --- | --- | --- |
| SPHEREx DR1 HiPS cube | Vista del cielo, 102 bandas | `https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube` (frame = 17·(banda−1) + (canal−1); frames 50 y 51 vacíos) |
| SPHEREx Level 2 spectral images | Serie temporal, espectros | SIA v2: `https://irsa.ipac.caltech.edu/SIA?COLLECTION=spherex_dr1&POS=CIRCLE ra dec r&RESPONSEFORMAT=CSV` (también `spherex_qr3`, `*_deep`) |
| Cutouts | Recortes por imagen | `<access_url>?center=<ra>,<dec>d&size=<deg>` (MEF FITS: IMAGE, FLAGS, VARIANCE, ZODI, PSF, WCS-WAVE) |
| TAP `spherex.artifact`/`spherex.plane` | Datos recién ingeridos (sin el ~1 día de demora de SIA) | `https://irsa.ipac.caltech.edu/TAP` (lento: >90 s en pruebas) |
| Gaia DR3 | Overlay de catálogo, movimientos propios | CDS VizieR `I/355/gaiadr3` |
| WISE / unWISE | Comparación de épocas previas | HiPS CDS `CDS/P/unWISE/color-W2-W1W2-W1` |

## Objetivos de prueba del challenge

Estrella de Barnard, Epsilon Indi B, WISE 0855−0714 (RA 08h55m10.831s, Dec −7d14m42.53s), RW Aurigae y R Draconis.
Ver `apps/web/src/data/targets.ts` (incluye movimiento propio para estimar la posición en la época SPHEREx).

## Referencias

- IRSA SPHEREx: https://irsa.ipac.caltech.edu/Missions/spherex.html
- Tutoriales: https://caltech-ipac.github.io/irsa-tutorials/spherex/
- Explanatory Supplement: https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp.pdf
- WiseView (inspiración): http://byw.tools/wiseview
