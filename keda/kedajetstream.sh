kubectl apply -f kedajetstream.yaml

kubectl get svc -n nats-system 

kubectl get scaledobject resume-parser-jetstream

kubectl port-forward pod/nats-0 -n nats-system 4223:4222 8222:8222


