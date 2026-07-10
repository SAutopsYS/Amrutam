terraform {
  required_version = ">= 1.6.0"

  required_providers {
    # Uncomment and configure for your cloud provider:
    # aws = { source = "hashicorp/aws", version = "~> 5.0" }
    # google = { source = "hashicorp/google", version = "~> 5.0" }
    # azurerm = { source = "hashicorp/azurerm", version = "~> 3.0" }
  }

  backend "local" {
    # Replace with remote backend for production:
    # backend "s3" { bucket = "..." key = "..." region = "..." }
    path = "terraform.tfstate"
  }
}
