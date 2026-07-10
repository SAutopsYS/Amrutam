output "vpc_id" {
  description = "VPC identifier"
  value       = module.networking.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs for data tier"
  value       = module.networking.private_subnet_ids
}

output "public_subnet_ids" {
  description = "Public subnet IDs for ingress/load balancers"
  value       = module.networking.public_subnet_ids
}

output "postgres_endpoint" {
  description = "PostgreSQL connection endpoint (placeholder until provider wired)"
  value       = module.postgresql.endpoint
}

output "redis_endpoint" {
  description = "Redis connection endpoint (placeholder until provider wired)"
  value       = module.redis.endpoint
}

output "monitoring_dashboard_url" {
  description = "Monitoring dashboard URL placeholder"
  value       = module.monitoring.dashboard_url
}

output "kubernetes_cluster_name" {
  description = "Kubernetes cluster name when enabled"
  value       = var.enable_kubernetes ? module.kubernetes[0].cluster_name : null
}
