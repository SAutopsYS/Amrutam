variable "name_prefix" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "tags" { type = map(string) }

output "dashboard_url" {
  description = "Grafana or cloud monitoring dashboard URL placeholder"
  value       = "https://grafana.${var.name_prefix}.internal"
}

output "prometheus_endpoint" {
  value = "https://prometheus.${var.name_prefix}.internal"
}
