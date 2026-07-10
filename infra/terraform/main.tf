locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

module "networking" {
  source = "./modules/networking"

  name_prefix = local.name_prefix
  vpc_cidr    = var.vpc_cidr
  region      = var.region
  tags        = var.tags
}

module "postgresql" {
  source = "./modules/postgresql"

  name_prefix = local.name_prefix
  vpc_id      = module.networking.vpc_id
  subnet_ids  = module.networking.private_subnet_ids
  instance_class = var.postgres_instance_class
  tags        = var.tags
}

module "redis" {
  source = "./modules/redis"

  name_prefix = local.name_prefix
  vpc_id      = module.networking.vpc_id
  subnet_ids  = module.networking.private_subnet_ids
  node_type   = var.redis_node_type
  tags        = var.tags
}

module "monitoring" {
  source = "./modules/monitoring"

  name_prefix = local.name_prefix
  vpc_id      = module.networking.vpc_id
  subnet_ids  = module.networking.private_subnet_ids
  tags        = var.tags
}

module "kubernetes" {
  count  = var.enable_kubernetes ? 1 : 0
  source = "./modules/kubernetes"

  name_prefix = local.name_prefix
  vpc_id      = module.networking.vpc_id
  subnet_ids  = module.networking.private_subnet_ids
  tags        = var.tags
}
