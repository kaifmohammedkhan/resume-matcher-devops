#!/usr/bin/env bash

ZROK="/c/zrok/zrok.exe"
NAME="my-jenkins-local"
NAMESPACE="public"
TARGET="http://host.docker.internal:8080"

echo "=========================================="
echo "Starting zrok share reset sequence..."
echo "=========================================="

# Find share token associated with the name
TOKEN=$(
  "$ZROK" overview |
  grep -B 5 "${NAME}.shares.zrok.io" |
  grep -oE '[a-z0-9]{12}' |
  head -1
)

if [[ -n "$TOKEN" ]]; then
  echo "[INFO] Found existing share: $TOKEN"
  "$ZROK" delete share "$TOKEN"
  sleep 2
fi

echo "[INFO] Releasing reserved name..."
"$ZROK" delete name -n "$NAMESPACE" "$NAME" 2>/dev/null

sleep 2

echo "[INFO] Creating reserved name..."
if ! "$ZROK" create name -n "$NAMESPACE" "$NAME"; then
  echo "[WARNING] Named reservation still unavailable."
  echo "[FALLBACK] Starting ephemeral share..."
  exec "$ZROK" share public "$TARGET"
fi

echo "[INFO] Starting named share..."
exec "$ZROK" share public "$TARGET" -n "${NAMESPACE}:${NAME}"