locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

module "networking" {
  source = "./modules/networking"

  name_prefix        = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  tags               = var.tags
}

module "security_groups" {
  source = "./modules/security_groups"

  name_prefix = local.name_prefix
  vpc_id      = module.networking.vpc_id
  tags        = var.tags
}

module "secrets" {
  source = "./modules/secrets"

  name_prefix        = local.name_prefix
  jwt_access_secret  = var.jwt_access_secret
  jwt_refresh_secret = var.jwt_refresh_secret
  db_username        = var.postgres_username
  db_password        = module.postgresql.db_password
  db_endpoint        = module.postgresql.endpoint
  db_name            = var.postgres_db_name
  redis_endpoint     = module.redis.primary_endpoint
  tags               = var.tags
}

module "postgresql" {
  source = "./modules/postgresql"

  name_prefix        = local.name_prefix
  vpc_id             = module.networking.vpc_id
  subnet_ids         = module.networking.private_subnet_ids
  security_group_ids = [module.security_groups.postgres_sg_id]
  instance_class     = var.postgres_instance_class
  db_name            = var.postgres_db_name
  username           = var.postgres_username
  tags               = var.tags
}

module "redis" {
  source = "./modules/redis"

  name_prefix        = local.name_prefix
  subnet_ids         = module.networking.private_subnet_ids
  security_group_ids = [module.security_groups.redis_sg_id]
  node_type          = var.redis_node_type
  tags               = var.tags
}

module "alb" {
  source = "./modules/alb"

  name_prefix        = local.name_prefix
  vpc_id             = module.networking.vpc_id
  public_subnet_ids  = module.networking.public_subnet_ids
  security_group_ids = [module.security_groups.alb_sg_id]
  certificate_arn    = var.certificate_arn
  tags               = var.tags
}

module "ecs" {
  count  = var.enable_kubernetes ? 0 : 1
  source = "./modules/ecs"

  name_prefix         = local.name_prefix
  vpc_id              = module.networking.vpc_id
  private_subnet_ids  = module.networking.private_subnet_ids
  security_group_ids  = [module.security_groups.app_sg_id]
  target_group_arn    = module.alb.target_group_arn
  container_image     = var.container_image
  desired_count       = var.app_desired_count
  cpu                 = var.app_cpu
  memory              = var.app_memory
  secrets_arn         = module.secrets.app_secret_arn
  aws_region          = var.region
  tags                = var.tags
}

module "monitoring" {
  source = "./modules/monitoring"

  name_prefix    = local.name_prefix
  alb_arn_suffix = module.alb.alb_arn_suffix
  tags           = var.tags
}

module "kubernetes" {
  count  = var.enable_kubernetes ? 1 : 0
  source = "./modules/kubernetes"

  name_prefix        = local.name_prefix
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  public_subnet_ids  = module.networking.public_subnet_ids
  tags               = var.tags
}
