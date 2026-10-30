#!/usr/bin/env bash
set -e

# Load environment variables from .env file securely
if [ -f .env ]; then
  set -a
  source .env
  set +a
else
  echo "Error: .env file not found."
  exit 1
fi

# Validate required variables (including EMAIL_USER and EMAIL_PASS)
if [ -z "$USERNAME" ] || [ -z "$GITHUB_TOKEN" ] || [ -z "$ARGOCD_AUTH_TOKEN" ] || [ -z "$ARGO_GITHUB" ] || [ -z "$EMAIL_USER" ] || [ -z "$EMAIL_PASS" ]; then
  echo "Error: USERNAME, GITHUB_TOKEN, ARGOCD_AUTH_TOKEN, ARGO_GITHUB, EMAIL_USER, and EMAIL_PASS must be defined in the .env file."
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
  --namespace=argocd \
  --from-literal=ARGOCD_AUTH_TOKEN="$ARGOCD_AUTH_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

# Create or update the GitHub verification token secret idempotently using the isolated literal value
echo "Creating/updating Kubernetes secret 'github-verifier-token'..."
kubectl create secret generic github-verifier-token \
  --namespace=argocd \
  --from-literal=ARGO_GITHUB="$ARGO_GITHUB" \
  --dry-run=client -o yaml | kubectl apply -f -

# Create or update the Alertmanager SMTP credentials secret idempotently in the monitoring namespace
echo "Creating/updating Kubernetes secret 'alertmanager-smtp-credentials'..."
kubectl create secret generic alertmanager-smtp-credentials \
  --namespace=monitoring \
  --from-literal=smtp-username="$EMAIL_USER" \
  --from-literal=smtp-password="$EMAIL_PASS" \
  --dry-run=client -o yaml | kubectl apply -f -

# Create or update the Prometheus Operator Alertmanager configuration secret idempotently in the monitoring namespace
echo "Creating/updating Kubernetes secret 'alertmanager-monitoring-kube-prometheus-alertmanager'..."
kubectl create secret generic alertmanager-monitoring-kube-prometheus-alertmanager \
  --namespace=monitoring \
  --from-literal=alertmanager.yaml="$(cat <<EOF
global:
  resolve_timeout: 5m
inhibit_rules:
- equal:
  - namespace
  - alertname
  source_matchers:
  - severity = critical
  target_matchers:
  - severity =~ warning|info
- equal:
  - namespace
  - alertname
  source_matchers:
  - severity = warning
  target_matchers:
  - severity = info
- equal:
  - namespace
  source_matchers:
  - alertname = InfoInhibitor
  target_matchers:
  - severity = info
- target_matchers:
  - alertname = InfoInhibitor
receivers:
- name: "null"
- name: "email-notifications"
  email_configs:
  - to: "$EMAIL_USER"
    from: "$EMAIL_USER"
    smarthost: "smtp.gmail.com:587"
    auth_username: "$EMAIL_USER"
    auth_password: "$EMAIL_PASS"
    require_tls: true
    send_resolved: true
route:
  group_by:
  - namespace
  group_interval: 5m
  group_wait: 30s
  receiver: "null"
  repeat_interval: 12h
  routes:
  - matchers:
    - alertname = "Watchdog"
    receiver: "null"
  - matchers:
    - alertname = "ResumeMatcherZeroReplicas"
    receiver: "email-notifications"
    group_wait: 10s
    repeat_interval: 1h
templates:
- /etc/alertmanager/config/*.tmpl
EOF
)" \
  --dry-run=client -o yaml | kubectl apply -f -

# Force Alertmanager to restart and reload the new configuration
echo "Restarting Alertmanager to apply configuration changes..."
kubectl rollout restart statefulset/alertmanager-monitoring-kube-prometheus-alertmanager -n monitoring

echo "=============================================="
echo "ALL KUBERNETES SECRETS CONFIGURATION COMPLETED"
echo "=============================================="