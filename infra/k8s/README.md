# Kubernetes Deployment — Amrutam Backend

Production-ready manifests for deploying the Amrutam telemedicine API on Kubernetes.

## Manifests

| File | Purpose |
|------|---------|
| `namespace.yaml` | Isolated `amrutam` namespace |
| `configmap.yaml` | Non-sensitive runtime configuration |
| `secret.yaml` | Secret template (replace placeholders) |
| `deployment.yaml` | API Deployment with probes, resources, rolling updates |
| `service.yaml` | ClusterIP Service |
| `ingress.yaml` | TLS-terminated external access |
| `hpa.yaml` | CPU/memory autoscaling (3–20 replicas) |
| `pdb.yaml` | Minimum 2 pods available during disruptions |
| `networkpolicy.yaml` | Ingress/egress network isolation |

## Prerequisites

- Kubernetes 1.28+
- Ingress controller (nginx recommended)
- cert-manager (optional, for TLS)
- PostgreSQL and Redis reachable from the cluster (managed or in-cluster)
- Container image published to your registry

## Quick Deploy

```bash
# 1. Edit secret.yaml with real credentials (or use External Secrets)
# 2. Update ingress host and image in kustomization.yaml
kubectl apply -k infra/k8s/
```

## Rolling Updates

The Deployment uses a **RollingUpdate** strategy with `maxUnavailable: 0` and `maxSurge: 1`, ensuring zero-downtime rollouts when combined with readiness probes.

```bash
kubectl set image deployment/amrutam-backend \
  api=ghcr.io/amrutam/amrutam-backend:v1.2.0 -n amrutam
kubectl rollout status deployment/amrutam-backend -n amrutam
```

## Health Probes

| Probe | Path | Purpose |
|-------|------|---------|
| Liveness | `/api/v1/health/live` | Restart unhealthy pods |
| Readiness | `/api/v1/health/ready` | Remove pods from Service during startup/failure |

## Graceful Shutdown

- `terminationGracePeriodSeconds: 60` allows in-flight requests to complete
- `preStop` hook sleeps 10s so the Service endpoints update before SIGTERM
- Application handles SIGTERM via NestJS shutdown hooks (see `src/shutdown/`)

## Resource Sizing

| | CPU | Memory |
|---|-----|--------|
| Request | 250m | 512Mi |
| Limit | 1 | 1Gi |

Adjust based on load testing. HPA targets 70% CPU and 80% memory utilization.

## Rollback

```bash
kubectl rollout undo deployment/amrutam-backend -n amrutam
kubectl rollout history deployment/amrutam-backend -n amrutam
```

## Security Notes

- Pods run as non-root user `1001` (matches Docker image)
- NetworkPolicy restricts traffic to ingress controller, observability, Postgres, Redis, and DNS
- Never commit populated `secret.yaml` — use Sealed Secrets or cloud secret managers

See also: [Disaster Recovery](../../docs/operations/disaster-recovery.md)
