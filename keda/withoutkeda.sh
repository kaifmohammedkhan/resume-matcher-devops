kubectl apply -f configmap.yaml
kubectl apply -f db-secret.yaml
kubectl apply -f google-api-secret.yaml
kubectl apply -f google-cx-id.yaml
kubectl apply -f postgres.yaml
kubectl apply -f postgres-pvc.yaml
kubectl apply -f resume-matcher-ghcr.yaml
kubectl apply -f service.yaml