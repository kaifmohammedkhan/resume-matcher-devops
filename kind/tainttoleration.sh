kubectl apply -f resume-matcher-ghcr.yaml

kubectl rollout restart deployment resume-matcher-ghcr

kubectl get pods -l app=resume-matcher-ghcr -o wide | grep resume-matcher-ghcr

kubectl describe node kind-node-worker2 | grep Taints
