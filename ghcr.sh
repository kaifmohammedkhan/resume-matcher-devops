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
if [ -z "$USERNAME" ] || [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: USERNAME and GITHUB_TOKEN must be defined in the .env file."
  exit 1
fi

# Log in to GitHub Container Registry securely using stdin
echo "Logging in to GHCR..."
echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$USERNAME" --password-stdin

# Create or update the Kubernetes secret idempotently
echo "Creating/updating Kubernetes secret 'ghcr-secret'..."
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username="$USERNAME" \
  --docker-password="$GITHUB_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -