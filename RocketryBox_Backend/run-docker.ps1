# Run RocketryBox Backend Docker Container
# Usage: .\run-docker.ps1 [options]

param(
  [string]$ImageTag = "rocketrybox-backend:latest",
  [string]$ContainerName = "rocketrybox-backend",
  [string]$Port = "8000",
  [string]$EnvFile = ".env",
  [switch]$Detached = $true,
  [switch]$RemoveExisting = $false
)

Write-Host "🚀 Running RocketryBox Backend Container..." -ForegroundColor Green

# Check if .env file exists
if (-not (Test-Path $EnvFile)) {
  Write-Host "❌ Error: Environment file '$EnvFile' not found!" -ForegroundColor Red
  Write-Host "Please create a .env file with all required environment variables." -ForegroundColor Yellow
  Write-Host "You can copy from env.docker.template and fill in your values:" -ForegroundColor Yellow
  Write-Host "Copy-Item env.docker.template .env" -ForegroundColor Gray
  exit 1
}

# Check if image exists
$imageExists = docker images -q $ImageTag
if (-not $imageExists) {
  Write-Host "❌ Error: Docker image '$ImageTag' not found!" -ForegroundColor Red
  Write-Host "Please build the image first using: .\build-docker.ps1" -ForegroundColor Yellow
  exit 1
}

# Remove existing container if requested
if ($RemoveExisting) {
  Write-Host "🗑️ Removing existing container..." -ForegroundColor Yellow
  docker stop $ContainerName 2>$null
  docker rm $ContainerName 2>$null
}

# Check if container already exists
$containerExists = docker ps -a -q -f "name=$ContainerName"
if ($containerExists) {
  Write-Host "⚠️ Container '$ContainerName' already exists!" -ForegroundColor Yellow
  Write-Host "Use -RemoveExisting to remove it first, or choose a different name." -ForegroundColor Yellow
  exit 1
}

# Build the docker run command
$runArgs = @(
  "run"
  "--name", $ContainerName
  "-p", "${Port}:8000"
  "--env-file", $EnvFile
  "-v", "${PWD}/uploads:/app/uploads"
  "-v", "${PWD}/logs:/app/logs"
  "--restart", "unless-stopped"
)

if ($Detached) {
  $runArgs += "-d"
}

$runArgs += $ImageTag

# Run the container
Write-Host "🔧 Starting container with the following configuration:" -ForegroundColor Blue
Write-Host "Image: $ImageTag" -ForegroundColor White
Write-Host "Container: $ContainerName" -ForegroundColor White
Write-Host "Port: $Port" -ForegroundColor White
Write-Host "Env File: $EnvFile" -ForegroundColor White
Write-Host "Mode: $(if ($Detached) { 'Detached' } else { 'Interactive' })" -ForegroundColor White

docker @runArgs

if ($LASTEXITCODE -eq 0) {
  Write-Host "✅ Backend container started successfully!" -ForegroundColor Green

  if ($Detached) {
    Write-Host "`n📊 Container Status:" -ForegroundColor Cyan
    docker ps -f "name=$ContainerName"

    Write-Host "`n🌐 Backend API available at:" -ForegroundColor Yellow
    Write-Host "http://localhost:$Port" -ForegroundColor White
    Write-Host "Health Check: http://localhost:$Port/health" -ForegroundColor White

    Write-Host "`n📝 Useful Commands:" -ForegroundColor Cyan
    Write-Host "View logs: docker logs -f $ContainerName" -ForegroundColor White
    Write-Host "Stop container: docker stop $ContainerName" -ForegroundColor White
    Write-Host "Remove container: docker rm $ContainerName" -ForegroundColor White
  }
}
else {
  Write-Host "❌ Failed to start container!" -ForegroundColor Red
  exit 1
}
