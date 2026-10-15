#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="argocd"
TIMEOUT=300
SECONDS_PASSED=0

echo "=========================================="
echo "Waiting for ArgoCD pods in namespace '$NAMESPACE'..."
echo "=========================================="

# Loop until all pods in the namespace are created and ready
while true; do
    # Check if any pods exist yet
    TOTAL_PODS=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
    
    if [ "$TOTAL_PODS" -gt 0 ]; then
        # Count how many pods have all containers ready (e.g., 1/1, 2/2)
        READY_PODS=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | awk '{print $2}' | grep -E "^([0-9]+)/\1$" | wc -l)

        if [ "$READY_PODS" -eq "$TOTAL_PODS" ]; then
            echo "Success: All $TOTAL_PODS ArgoCD pods are running and ready!"
            break
        fi
        echo "Pods status: $READY_PODS/$TOTAL_PODS ready. Waiting..."
    else
        echo "No pods found in namespace '$NAMESPACE' yet. Waiting..."
    fi

    if [ "$SECONDS_PASSED" -ge "$TIMEOUT" ]; then
        echo "ERROR: Timeout reached waiting for ArgoCD pods."
        exit 1
    fi

    sleep 5
    SECONDS_PASSED=$((SECONDS_PASSED + 5))
done

echo "=========================================="
echo "Starting port-forward for argocd-server..."
echo "=========================================="

# Start port-forwarding (binds to localhost:8080 targeting port 443 on the service)
kubectl port-forward svc/argocd-server -n "$NAMESPACE" 8080:443