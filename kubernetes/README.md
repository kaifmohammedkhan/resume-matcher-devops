# Kubernetes Manifests for `resume-matcher-devops`

This folder contains Kubernetes manifests to deploy the `resume-matcher-devops` application in a cloud-native, enterprise-grade environment.

## 📦 Included Manifests

| File             | Purpose                                      |
|------------------|----------------------------------------------|
| `deployment.yaml`| Defines the app container, replicas, probes |
| `service.yaml`   | Exposes the app inside the cluster           |
| `ingress.yaml`   | Routes external traffic via domain + path    |
| `configmap.yaml` | (Optional) Injects config/env variables      |

## 🚀 Deployment Instructions

### 1. Apply Manifests
```bash
kubectl apply -f kubernetes/deployment.yaml
kubectl apply -f kubernetes/service.yaml
kubectl apply -f kubernetes/ingress.yaml
