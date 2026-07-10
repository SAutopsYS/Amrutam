variable "name_prefix" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "node_type" { type = string }
variable "tags" { type = map(string) }

output "endpoint" {
  description = "Redis endpoint — replace with managed cluster address"
  value       = "${var.name_prefix}-redis.internal:6379"
}
