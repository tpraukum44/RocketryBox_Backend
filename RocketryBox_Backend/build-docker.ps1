# Build RocketryBox Backend Docker Image
# Usage: .\build-docker.ps1 [tag]

param(
  [string]$Tag = "rocketrybox-backend:latest"
)

Write-Host "🐳 Building RocketryBox Backend Docker Image..." -ForegroundColor Green
Write-Host "Tag: $Tag" -ForegroundColor Yellow

# Check if we're in the backend directory
if (-not (Test-Path "package.json")) {
  Write-Host "❌ Error: package.json not found! Are you in the backend directory?" -ForegroundColor Red
  Write-Host "Please run this script from the backend directory: cd backend && .\build-docker.ps1" -ForegroundColor Yellow
  exit 1
}

# Check if Dockerfile exists
if (-not (Test-Path "Dockerfile")) {
  Write-Host "❌ Error: Dockerfile not found in backend directory!" -ForegroundColor Red
  exit 1
}

# Build the Docker image
Write-Host "🔨 Building Docker image..." -ForegroundColor Blue
docker build -t $Tag .

if ($LASTEXITCODE -eq 0) {
  Write-Host "✅ Backend Docker image built successfully!" -ForegroundColor Green
  Write-Host "Image: $Tag" -ForegroundColor Yellow

  # Show image details
  Write-Host "`n📊 Image Details:" -ForegroundColor Cyan
  docker images $Tag

  Write-Host "`n🚀 To run the container:" -ForegroundColor Cyan
  Write-Host "1. Create .env file with required variables (copy from env.docker.template)" -ForegroundColor White
  Write-Host "2. Run: docker run -d --name rocketrybox-backend -p 8000:8000 --env-file .env $Tag" -ForegroundColor White

  Write-Host "`n📝 Required environment variables:" -ForegroundColor Yellow
  Write-Host "- MONGODB_ATLAS_URI" -ForegroundColor White
  Write-Host "- JWT_SECRET" -ForegroundColor White
  Write-Host "- JWT_REFRESH_SECRET" -ForegroundColor White
  Write-Host "- ADMIN_EMAIL" -ForegroundColor White
  Write-Host "- REDIS_HOST" -ForegroundColor White
  Write-Host "- REDIS_PASSWORD" -ForegroundColor White
}
else {
  Write-Host "❌ Failed to build Docker image!" -ForegroundColor Red
  exit 1
}
