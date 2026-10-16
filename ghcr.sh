#!/usr/bin/env bash
set -e

# Load environment variables from .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "Error: .env file not found."
  exit 1
fi

# Validate required variables
if [ -z "$USERNAME" ] || [ -z "$GITHUB_TOKEN" ] || [ -z "$ARGOCD_AUTH_TOKEN" ]; then
  echo "Error: USERNAME, GITHUB_TOKEN, and ARGOCD_AUTH_TOKEN must be defined in the .env file."
  exit 1
fi

# Log in to GitHub Container Registry securely using stdin
echo "Logging in to GHCR..."
echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$USERNAME" --password-stdin

# Create or update the Kubernetes registry secret idempotently
echo "Creating/updating Kubernetes secret 'ghcr-secret'..."
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username="$USERNAME" \
  --docker-password="$GITHUB_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

# Create or update the Argo CD verifier token secret idempotently
echo "Creating/updating Kubernetes secret 'argocd-verifier-token'..."
kubectl create secret generic argocd-verifier-token \
  --namespace=default \
  --from-literal=ARGOCD_AUTH_TOKEN="$ARGOCD_AUTH_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "=============================================="
echo "ALL KUBERNETES SECRETS CONFIGURATION COMPLETED"
echo "=============================================="
