# Autonomous Enterprise Cloud Deployment

## Prerequisites

Install and authenticate `kubectl`, Helm 3, a Kubernetes cluster, cert-manager, and External Secrets Operator. Configure DNS, TLS issuer, container registry access, managed PostgreSQL/Redis/Kafka endpoints, and least-privilege cloud IAM (IRSA on EKS or Workload Identity on GKE).

## Deploy

```sh
kubectl create namespace autonomous-enterprise --dry-run=client -o yaml | kubectl apply -f -
helm repo add jetstack https://charts.jetstack.io
helm upgrade --install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --set crds.enabled=true
helm upgrade --install autonomous-enterprise ./infrastructure/helm/autonomous-enterprise -n autonomous-enterprise -f infrastructure/cloud/values-eks.yaml
# On GKE, use values-gke.yaml instead.
```

Set real image tags, hosts, certificate identifiers, endpoints, and secret-store configuration before production deployment. Do not place credentials in values files.

## Verification and smoke testing

```sh
kubectl -n autonomous-enterprise get pods,svc,ingress
kubectl -n autonomous-enterprise rollout status deploy -l app.kubernetes.io/part-of=autonomous-enterprise
helm -n autonomous-enterprise list
kubectl -n autonomous-enterprise port-forward svc/<release>-autonomous-enterprise-api 3000:3000
curl -fsS http://127.0.0.1:3000/api/v1/health
curl -fsS http://127.0.0.1:3000/api/v1/metrics
```

Verify HTTPS for both hosts, API-to-PostgreSQL/Redis/Kafka connectivity, Keycloak JWKS validation, tenant isolation, HPA behavior, ServiceMonitor targets, alerts, secret synchronization, and rollback readiness.

## Troubleshooting

- `ImagePullBackOff`: check registry credentials, repository/tag, and node egress.
- Pending pods: inspect `kubectl describe pod`; validate requests, node capacity, taints, and affinity.
- 502 or failed probes: inspect API/web logs and confirm service target ports and health paths.
- TLS/Ingress issues: inspect `kubectl describe ingress`, DNS, certificate status, and cloud load-balancer events.
- Missing secrets: inspect ExternalSecret status and cloud IAM bindings; never print secret values.
- HPA not scaling: verify metrics-server, resource requests, and `kubectl describe hpa`.
- Roll back with `helm rollback <release> <revision> -n autonomous-enterprise`.
