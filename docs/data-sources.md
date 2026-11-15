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
Ver `apps/web/src/data/targets.ts`. Las posiciones y movimientos propios se consultaron el 2026-11-15 mediante IRSA SCS en `gaia_dr3_source` y `catwise_2020`; las coordenadas están en ICRS, Gaia DR3 está referido a época 2016.0 y μRA incluye cos δ.

| Objetivo | RA (°) | Dec (°) | Época | Movimiento propio (mas/año) | Paralaje (mas) | Fuente |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Estrella de Barnard | 269.44850252544 | 4.73942005111 | 2016.0 | −801.551, +10362.394 | 546.9759 | Gaia DR3 4472832130942575872 |
| Epsilon Indi B | 331.07645259656 | −56.79381206688 | 2016.0 | +3981.977, −2466.832 | 270.6580 | Gaia DR3 6412596012146801152 |
| WISE 0855−0714 | 133.7839831 | −7.2441961 | 2015.401779603 | −7965.0, +806.2 | 449.0 | CatWISE2020 J085508.34-071439.2 |
| RW Aurigae A | 76.95654431103 | 30.40131614989 | 2016.0 | +4.906, −24.578 | 5.4541 | Gaia DR3 156430817820015232 |
| R Draconis | 248.16737836729 | 66.75500674547 | 2016.0 | −20.643, +6.149 | 1.2509 | Gaia DR3 1648328016354496384 |

La paralaje de WISE 0855 es un valor bibliográfico de Luhman & Esplin (2016); no se volvió a verificar en esta consulta. Epsilon Indi B está sin resolver como Ba+Bb en Gaia DR3 (RUWE 4.3). RW Aur A tiene RUWE 16.4; su compañera B (Gaia DR3 156430822114424576) está a 1.4″ al sudoeste. La efeméride solar de baja precisión puede desviarse ~0.01 AU, equivalente a menos de 6 mas para Barnard. Los marcadores no modelan aberración: HiPS y los recortes se interpretan en ICRS astrométrico.

## Referencias

- IRSA SPHEREx: https://irsa.ipac.caltech.edu/Missions/spherex.html
- Tutoriales: https://caltech-ipac.github.io/irsa-tutorials/spherex/
- Explanatory Supplement: https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp.pdf
- WiseView (inspiración): http://byw.tools/wiseview
