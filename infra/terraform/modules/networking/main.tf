terraform {
  required_providers {}
}

variable "name_prefix" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "region" {
  type = string
}

variable "tags" {
  type = map(string)
}

# Placeholder outputs — wire to aws_vpc, google_compute_network, etc.
output "vpc_id" {
  value = "${var.name_prefix}-vpc"
}

output "private_subnet_ids" {
  value = [
    "${var.name_prefix}-private-a",
    "${var.name_prefix}-private-b",
  ]
}

output "public_subnet_ids" {
  value = [
    "${var.name_prefix}-public-a",
    "${var.name_prefix}-public-b",
  ]
}
