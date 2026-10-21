#!/usr/bin/env bash

# Exit immediately if any command fails
set -e

echo "=== 1. Pods in 'default' Namespace ==="
kubectl get pods -n default
echo ""

echo "=== 2. Pods in 'argocd' Namespace ==="
kubectl get pods -n argocd
echo ""

echo "=== 3. Container Image IDs for resume-matcher-ghcr ==="
kubectl get pods -l app=resume-matcher-ghcr -o jsonpath='{range .items[*].status.containerStatuses[*]}{.name}: {.imageID}{"\n"}{end}'
echo ""

echo "=== 4. Starting Port Forwarding ==="
echo "Forwarding local port 8081 to deployment port 3000..."
echo "Press Ctrl+C to stop forwarding."
echo ""

# Execute port-forward
kubectl port-forward deployment/resume-matcher-ghcr 8081:3000
