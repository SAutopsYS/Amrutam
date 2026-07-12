# Terraform — Amrutam Production Infrastructure (AWS)

Provisions a production-ready AWS footprint for the Amrutam Telemedicine API.

## Modules

| Module | Resources |
|--------|-----------|
| `networking` | VPC, public/private subnets, IGW, NAT, route tables |
| `security_groups` | ALB, app, PostgreSQL, Redis security groups |
| `postgresql` | RDS PostgreSQL 16 Multi-AZ, encrypted, backups |
| `redis` | ElastiCache Redis 7 Multi-AZ, encryption at rest/transit |
| `secrets` | Secrets Manager JSON (JWT, DB URL, Redis, MFA key) |
| `alb` | Application Load Balancer + target group + listeners |
| `ecs` | Fargate cluster, service, autoscaling, CloudWatch logs |
| `monitoring` | CloudWatch dashboard + 5xx alarm + SNS topic |
| `kubernetes` | Optional EKS cluster + managed node group |

Default path uses **ECS Fargate**. Set `enable_kubernetes = true` for EKS instead.

## Prerequisites

- Terraform >= 1.6
- AWS credentials configured (`aws configure` or env vars)
- ACM certificate ARN (optional, for HTTPS)

## Deploy

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit secrets and region

terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

Outputs include ALB DNS, RDS endpoint, Redis endpoint, and Secrets Manager ARN.

## Wire the API image

1. Build and push: `docker build -f docker/Dockerfile -t <account>.dkr.ecr.<region>.amazonaws.com/amrutam:latest .`
2. Set `container_image` in `terraform.tfvars` to that URI
3. Re-apply Terraform (or force new ECS deployment)

## Destroy (non-production only)

```bash
# Disable deletion protection on RDS first if needed
terraform destroy
```

## Notes

- Secrets are never stored in git — use `terraform.tfvars` (gitignored) or CI secrets.
- RDS has `deletion_protection = true` and 7-day backups.
- ALB health check: `GET /api/v1/health/ready`
- App secrets are injected into ECS as JSON key references.
