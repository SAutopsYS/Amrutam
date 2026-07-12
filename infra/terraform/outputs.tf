output "vpc_id" {
  value = module.networking.vpc_id
}

output "private_subnet_ids" {
  value = module.networking.private_subnet_ids
}

output "public_subnet_ids" {
  value = module.networking.public_subnet_ids
}

output "rds_endpoint" {
  value     = module.postgresql.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value = module.redis.primary_endpoint
}

output "alb_dns_name" {
  value = module.alb.dns_name
}

output "app_secret_arn" {
  value = module.secrets.app_secret_arn
}

output "ecs_cluster_name" {
  value = try(module.ecs[0].cluster_name, null)
}

output "cloudwatch_dashboard_name" {
  value = module.monitoring.dashboard_name
}

output "eks_cluster_name" {
  value = try(module.kubernetes[0].cluster_name, null)
}
