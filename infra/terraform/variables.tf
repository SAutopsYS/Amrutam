variable "project_name" {
  description = "Project identifier used for resource naming"
  type        = string
  default     = "amrutam"
}

variable "environment" {
  description = "Deployment environment (dev, staging, production)"
  type        = string
  default     = "production"
}

variable "region" {
  description = "Primary AWS region"
  type        = string
  default     = "ap-south-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "AZs for public/private subnets (min 2)"
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]
}

variable "postgres_instance_class" {
  description = "RDS PostgreSQL instance class"
  type        = string
  default     = "db.t4g.medium"
}

variable "postgres_db_name" {
  type    = string
  default = "amrutam"
}

variable "postgres_username" {
  type    = string
  default = "amrutam"
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t4g.small"
}

variable "app_desired_count" {
  description = "ECS Fargate desired task count"
  type        = number
  default     = 3
}

variable "app_cpu" {
  type    = number
  default = 512
}

variable "app_memory" {
  type    = number
  default = 1024
}

variable "container_image" {
  description = "ECR image URI for the API (tag included)"
  type        = string
  default     = "public.ecr.aws/docker/library/node:20-alpine"
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS listener (optional)"
  type        = string
  default     = ""
}

variable "enable_kubernetes" {
  description = "Provision EKS cluster instead of ECS"
  type        = bool
  default     = false
}

variable "jwt_access_secret" {
  description = "JWT access secret stored in Secrets Manager"
  type        = string
  sensitive   = true
  default     = "replace-me-access-secret-min-32-characters!!"
}

variable "jwt_refresh_secret" {
  description = "JWT refresh secret stored in Secrets Manager"
  type        = string
  sensitive   = true
  default     = "replace-me-refresh-secret-min-32-characters!"
}

variable "tags" {
  description = "Common tags applied to all resources"
  type        = map(string)
  default = {
    Project     = "amrutam"
    ManagedBy   = "terraform"
    Application = "telemedicine-backend"
  }
}
