kubectl rollout restart deployment resume-matcher-ghcr

# Show new placement
kubectl get pods -l app=resume-matcher-ghcr -o wide | grep resume-matcher-ghcr

# Show label on new node
kubectl get node kind-node-worker2 --show-labels | grep zone