variable "name_prefix" { type = string }
variable "jwt_access_secret" {
  type      = string
  sensitive = true
}
variable "jwt_refresh_secret" {
  type      = string
  sensitive = true
}
variable "db_username" { type = string }
variable "db_password" {
  type      = string
  sensitive = true
}
variable "db_endpoint" { type = string }
variable "db_name" { type = string }
variable "redis_endpoint" { type = string }
variable "tags" { type = map(string) }

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.name_prefix}/app"
  recovery_window_in_days = 7
  tags                    = merge(var.tags, { Name = "${var.name_prefix}-app-secret" })
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    JWT_ACCESS_SECRET     = var.jwt_access_secret
    JWT_REFRESH_SECRET    = var.jwt_refresh_secret
    DATABASE_URL          = "postgresql://${var.db_username}:${var.db_password}@${var.db_endpoint}:5432/${var.db_name}?schema=public&connection_limit=20"
    REDIS_HOST            = var.redis_endpoint
    REDIS_PORT            = "6379"
    MFA_ENCRYPTION_KEY    = var.jwt_access_secret
    PAYMENT_WEBHOOK_SECRET = var.jwt_refresh_secret
  })
}

output "app_secret_arn" { value = aws_secretsmanager_secret.app.arn }
