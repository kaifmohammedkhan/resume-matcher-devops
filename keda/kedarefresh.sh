# 1. Drop the KEDA ScaledObject to completely destroy the HPA loop
kubectl delete scaledobject resume-parser-jetstream

# 2. Delete the NATS StatefulSet and FORCE kill the running pod instantly
kubectl delete statefulset nats -n nats-system
kubectl delete pod nats-0 -n nats-system --force --grace-period=0

# 3. (Optional but recommended) Clear your application deployment back to a true clean 0 baseline
kubectl scale deployment resume-matcher-ghcr --replicas=0