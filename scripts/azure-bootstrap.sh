#!/usr/bin/env bash
# One-time Azure setup for SPHEREx SkyLens. Requires `az login`; if `gh` is logged in, GitHub secrets/variables are set too.
#   bash scripts/azure-bootstrap.sh [location] [owner/repo]
set -euo pipefail

LOCATION="${1:-eastus2}"
REPO="${2:-LuiGs/spherex-skylens}"
RG="skylens-rg"
ENV_NAME="skylens-env"
API="skylens-api"
WEB="skylens-web"
SUB="$(az account show --query id -o tsv)"
ACR="skylens$(echo "${SUB}" | tr -d - | cut -c1-8)"

echo "==> Suscripción ${SUB}, región ${LOCATION}"
az extension add --name containerapp --upgrade --yes --only-show-errors
for ns in Microsoft.App Microsoft.OperationalInsights Microsoft.ContainerRegistry Microsoft.Web; do
  az provider register --namespace "${ns}" --wait
done

echo "==> Recursos base"
az group create -n "${RG}" -l "${LOCATION}" -o none
az acr show -n "${ACR}" -o none 2>/dev/null || az acr create -g "${RG}" -n "${ACR}" --sku Basic --admin-enabled true -o none
az containerapp env show -g "${RG}" -n "${ENV_NAME}" -o none 2>/dev/null \
  || az containerapp env create -g "${RG}" -n "${ENV_NAME}" -l "${LOCATION}" -o none
az staticwebapp show -g "${RG}" -n "${WEB}" -o none 2>/dev/null \
  || az staticwebapp create -g "${RG}" -n "${WEB}" -l "${LOCATION}" --sku Free -o none
WEB_HOST="$(az staticwebapp show -g "${RG}" -n "${WEB}" --query defaultHostname -o tsv)"

echo "==> Primer deploy de la API (Container Apps). Tarda unos minutos."
# ACR Tasks (az acr build) is blocked on trial subscriptions, so build locally with Docker.
az acr login -n "${ACR}"
docker buildx build --platform linux/amd64 -t "${ACR}.azurecr.io/${API}:bootstrap" --push apps/api
ACR_PASS="$(az acr credential show -n "${ACR}" --query 'passwords[0].value' -o tsv)"
if az containerapp show -g "${RG}" -n "${API}" -o none 2>/dev/null; then
  az containerapp update -g "${RG}" -n "${API}" --image "${ACR}.azurecr.io/${API}:bootstrap" -o none
else
  az containerapp create -g "${RG}" -n "${API}" --environment "${ENV_NAME}" \
    --image "${ACR}.azurecr.io/${API}:bootstrap" --registry-server "${ACR}.azurecr.io" \
    --registry-username "${ACR}" --registry-password "${ACR_PASS}" \
    --ingress external --target-port 8000 --min-replicas 0 --max-replicas 3 --cpu 0.5 --memory 1.0Gi \
    --env-vars "SKYLENS_CORS_ORIGINS=[\"https://${WEB_HOST}\"]" -o none
fi
API_URL="https://$(az containerapp show -g "${RG}" -n "${API}" --query properties.configuration.ingress.fqdn -o tsv)"

echo "==> Credenciales para GitHub Actions"
SWA_TOKEN="$(az staticwebapp secrets list -g "${RG}" -n "${WEB}" --query properties.apiKey -o tsv)"
AZ_CREDS="$(az ad sp create-for-rbac --name skylens-github --role contributor \
  --scopes "/subscriptions/${SUB}/resourceGroups/${RG}" --json-auth --only-show-errors)"

if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh secret set AZURE_CREDENTIALS -R "${REPO}" --body "${AZ_CREDS}"
  gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN -R "${REPO}" --body "${SWA_TOKEN}"
  gh variable set AZURE_RESOURCE_GROUP -R "${REPO}" --body "${RG}"
  gh variable set AZURE_ACR_NAME -R "${REPO}" --body "${ACR}"
  gh variable set VITE_API_URL -R "${REPO}" --body "${API_URL}"
  echo "Secrets y variables cargados en ${REPO}."
else
  umask 077
  printf '%s\n' "${AZ_CREDS}" > "${HOME}/skylens-azure-credentials.json"
  printf '%s\n' "${SWA_TOKEN}" > "${HOME}/skylens-swa-token.txt"
  cat <<MSG
Cargá en GitHub (Settings -> Secrets and variables -> Actions) y después borrá los archivos:
  Secret   AZURE_CREDENTIALS               = contenido de ~/skylens-azure-credentials.json
  Secret   AZURE_STATIC_WEB_APPS_API_TOKEN = contenido de ~/skylens-swa-token.txt
  Variable AZURE_RESOURCE_GROUP            = ${RG}
  Variable AZURE_ACR_NAME                  = ${ACR}
  Variable VITE_API_URL                    = ${API_URL}
MSG
fi

echo "Web: https://${WEB_HOST}"
echo "API: ${API_URL}/health"
