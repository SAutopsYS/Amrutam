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
  description = "Primary cloud region"
  type        = string
  default     = "ap-south-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "postgres_instance_class" {
  description = "Managed PostgreSQL instance size"
  type        = string
  default     = "db.r6g.large"
}

variable "redis_node_type" {
  description = "Managed Redis node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "enable_kubernetes" {
  description = "Provision Kubernetes cluster (future module)"
  type        = bool
  default     = false
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
