variable "name_prefix" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "instance_class" { type = string }
variable "tags" { type = map(string) }

output "endpoint" {
  description = "PostgreSQL endpoint — replace with managed instance address"
  value       = "${var.name_prefix}-postgres.internal:5432"
}

output "database_name" {
  value = "amrutam"
}
