# Deploy en Microsoft Azure (Global Offer de NASA Space Apps)

| Pieza | Servicio |
| --- | --- |
| Web (`apps/web`) | **Azure Static Web Apps** (plan Free): HTTPS, necesario para el modo AR, y preview en los PRs con la label `preview` |
| API (`apps/api`) | **Azure Container Apps** (consumo, escala a 0), imagen construida desde el `Dockerfile` en **Azure Container Registry** |
| Dominio | Global Offer GoDaddy Registry (registrado con Porkbun) → dominio custom en Static Web Apps |

La web llama a la API por su URL pública (`VITE_API_URL`, inyectada en el build) y la API solo acepta CORS desde el
dominio de la web (`SKYLENS_CORS_ORIGINS`).

## Setup (una sola vez)

1. **Crédito**: Global Offers → Microsoft → Azure → *Start free* ($200 por 30 días). Pide una tarjeta no prepaga para
   verificar; no se cobra nada mientras no pases a *pay-as-you-go*.
2. **Presupuesto** (recomendado): Cost Management → Budgets → crear uno de USD 25 con alertas por mail.
3. **Bootstrap**: con [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (`az login`),
   [GitHub CLI](https://cli.github.com/) (`gh auth login`) y Docker corriendo, desde la raíz del repo:
   ```bash
   bash scripts/azure-bootstrap.sh            # región por defecto: eastus2
   ```
   Crea el resource group `skylens-rg`, el registry, el entorno y la app `skylens-api`, la Static Web App
   `skylens-web` y un service principal limitado al resource group. Si `gh` está logueado, carga en el repo:
   - Secrets: `AZURE_CREDENTIALS`, `AZURE_STATIC_WEB_APPS_API_TOKEN`.
   - Variables: `AZURE_RESOURCE_GROUP`, `AZURE_ACR_NAME`, `VITE_API_URL`.

   Si no, los deja en archivos en `~` con instrucciones para cargarlos a mano.

   La primera imagen de la API se construye con Docker local (`linux/amd64`) porque las suscripciones de prueba no
   permiten ACR Tasks (`az acr build`).
4. Listo: cada push a `main` despliega web y API. Para tener un preview de Static Web Apps en un PR, agregale la label `preview` (el plan Free admite solo 3 previews a la vez; al cerrar el PR o quitar la label se borra).

Mientras `AZURE_RESOURCE_GROUP` no exista, los workflows de deploy se saltean y el CI sigue funcionando.

## Dominio propio (opcional)

1. Global Offer *Free Domain and Website Hosting* → dominio no premium → registralo en Porkbun.
2. Portal de Azure → `skylens-web` → *Custom domains* → *Add* → copiá el registro CNAME/TXT en el DNS de Porkbun.
   El certificado HTTPS es automático.
3. Agregá el dominio nuevo a `SKYLENS_CORS_ORIGINS` de `skylens-api`.

## Evitar cargos

- No actives *Upgrade to pay-as-you-go*. Al terminar el crédito o los 30 días, la suscripción se deshabilita sola.
- El registry Basic es lo único con costo fijo (≈ USD 5/mes, cubierto por el crédito).
- Al terminar el hackathon: `az group delete -n skylens-rg`.
