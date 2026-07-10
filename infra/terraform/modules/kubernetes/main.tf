variable "name_prefix" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "tags" { type = map(string) }

output "cluster_name" {
  description = "Kubernetes cluster name placeholder"
  value       = "${var.name_prefix}-eks"
}

output "cluster_endpoint" {
  description = "Kubernetes API endpoint placeholder"
  value       = "https://${var.name_prefix}-eks.internal"
}

# Future: EKS / GKE / AKS resources
# - Managed node groups or autopilot
# - IRSA / Workload Identity for pod-level IAM
# - Cluster autoscaler, metrics-server, ingress controller
