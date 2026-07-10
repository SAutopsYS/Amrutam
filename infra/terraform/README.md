# Terraform Infrastructure — Amrutam Platform

Modular Terraform skeleton for provisioning cloud infrastructure. **No provider-specific secrets are included** — wire your cloud credentials via environment variables or CI OIDC.

## Structure

```
infra/terraform/
├── main.tf              # Root module composition
├── variables.tf         # Input variables
├── outputs.tf           # Exported values
├── versions.tf          # Terraform & provider constraints
└── modules/
    ├── networking/      # VPC, subnets, security groups
    ├── postgresql/      # Managed PostgreSQL
    ├── redis/           # Managed Redis / ElastiCache
    ├── monitoring/      # Prometheus, Grafana, alerting
    └── kubernetes/      # Future EKS/GKE/AKS (disabled by default)
```

## Usage

```bash
cd infra/terraform
terraform init
terraform plan -var="environment=staging"
terraform apply -var="environment=staging"
```

Enable Kubernetes when ready:

```bash
terraform apply -var="enable_kubernetes=true"
```

## Module Responsibilities

| Module | Resources (to implement) |
|--------|------------------------|
| **networking** | VPC, public/private subnets, NAT, security groups |
| **postgresql** | RDS/Cloud SQL, parameter groups, backups, PITR |
| **redis** | ElastiCache/Memorystore, replication, persistence |
| **monitoring** | Managed Prometheus/Grafana or cloud observability |
| **kubernetes** | Managed cluster, node pools, ingress, IRSA |

## State Management

The default backend is **local** (`terraform.tfstate`). For production, configure a remote backend:

```hcl
backend "s3" {
  bucket         = "amrutam-terraform-state"
  key            = "production/terraform.tfstate"
  region         = "ap-south-1"
  encrypt        = true
  dynamodb_table = "terraform-locks"
}
```

## Secrets

- Database passwords, JWT secrets, and API keys are **not** managed in Terraform
- Use your cloud secret manager (AWS Secrets Manager, GCP Secret Manager, Azure Key Vault)
- Kubernetes secrets are applied separately via `infra/k8s/secret.yaml` or External Secrets Operator

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `project_name` | amrutam | Resource naming prefix |
| `environment` | production | dev / staging / production |
| `region` | ap-south-1 | Cloud region |
| `vpc_cidr` | 10.0.0.0/16 | VPC CIDR |
| `enable_kubernetes` | false | Provision K8s cluster |

See [Backup Strategy](../../docs/operations/backup.md) and [Disaster Recovery](../../docs/operations/disaster-recovery.md).
