# Bootstrap local development environment (Windows PowerShell).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host "Created .env from .env.example"
}

Write-Host "==> Installing dependencies"
npm ci

Write-Host "==> Starting infrastructure"
docker compose -f docker/docker-compose.yml up -d postgres redis prometheus grafana jaeger

Write-Host "==> Waiting for Postgres..."
do {
  Start-Sleep -Seconds 2
  $ready = docker compose -f docker/docker-compose.yml exec -T postgres pg_isready -U amrutam 2>$null
} while ($LASTEXITCODE -ne 0)

Write-Host "==> Running migrations"
npx prisma generate
npx prisma migrate deploy

Write-Host "==> Seeding database"
try { npm run prisma:seed } catch { Write-Host "Seed skipped or failed" }

Write-Host "`nSetup complete."
Write-Host "  npm run start:dev   # Local dev"
Write-Host "  npm run docker:up   # Full Docker stack"
