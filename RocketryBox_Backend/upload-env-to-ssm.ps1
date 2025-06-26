# =============================================================================
# AWS Systems Manager Parameter Store Upload Script
# =============================================================================
# This script reads environment variables from .env file and uploads them
# to AWS Systems Manager Parameter Store with the prefix /rocketrybox/prod/
# =============================================================================

param(
  [string]$EnvFile = ".env",
  [string]$Region = "ap-south-1",
  [string]$Prefix = "/rocketrybox/prod"
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "AWS SSM Parameter Store Upload Script" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if AWS CLI is installed
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  Write-Host "❌ AWS CLI is not installed or not in PATH" -ForegroundColor Red
  Write-Host "Please install AWS CLI and configure it with appropriate credentials" -ForegroundColor Yellow
  exit 1
}

# Check if env file exists
if (-not (Test-Path $EnvFile)) {
  Write-Host "❌ Environment file '$EnvFile' not found" -ForegroundColor Red
  Write-Host "Please create a .env file with your environment variables" -ForegroundColor Yellow
  exit 1
}

Write-Host "📄 Reading environment variables from: $EnvFile" -ForegroundColor Green
Write-Host "🌍 AWS Region: $Region" -ForegroundColor Green
Write-Host "🔧 Parameter Prefix: $Prefix" -ForegroundColor Green
Write-Host ""

# Set AWS region
$env:AWS_DEFAULT_REGION = $Region

# Read environment file and process each line
$envVars = @()
$content = Get-Content $EnvFile

foreach ($line in $content) {
  # Skip empty lines and comments
  if ($line -match '^\s*$' -or $line -match '^\s*#') {
    continue
  }

  # Parse KEY=VALUE format
  if ($line -match '^([^=]+)=(.*)$') {
    $key = $matches[1].Trim()
    $value = $matches[2].Trim()

    # Remove quotes if present
    $value = $value -replace '^["'']|["'']$', ''

    $envVars += @{
      Key   = $key
      Value = $value
    }
  }
}

Write-Host "Found $($envVars.Count) environment variables" -ForegroundColor Green
Write-Host ""

# Upload each environment variable to SSM Parameter Store
$successCount = 0
$errorCount = 0

foreach ($envVar in $envVars) {
  $parameterName = "$Prefix/$($envVar.Key)"

  Write-Host "Uploading: $($envVar.Key)" -ForegroundColor Cyan

  try {
    # Determine parameter type based on content
    $parameterType = "String"
    $sensitiveKeys = @(
      "PASSWORD", "SECRET", "KEY", "TOKEN", "URI", "MONGODB", "REDIS_PASSWORD",
      "JWT_SECRET", "JWT_REFRESH_SECRET", "WEBHOOK_SECRET", "COOKIE_SECRET",
      "AWS_SECRET_ACCESS_KEY", "API_KEY", "RAZORPAY", "BLUEDART", "DELHIVERY"
    )

    foreach ($sensitiveKey in $sensitiveKeys) {
      if ($envVar.Key -like "*$sensitiveKey*") {
        $parameterType = "SecureString"
        break
      }
    }

    # Upload to SSM Parameter Store
    $result = aws ssm put-parameter `
      --name $parameterName `
      --value $envVar.Value `
      --type $parameterType `
      --overwrite `
      --region $Region `
      2>&1

    if ($LASTEXITCODE -eq 0) {
      Write-Host "  ✅ Successfully uploaded as $parameterType" -ForegroundColor Green
      $successCount++
    }
    else {
      Write-Host "  ❌ Failed to upload: $result" -ForegroundColor Red
      $errorCount++
    }
  }
  catch {
    Write-Host "  ❌ Exception occurred: $($_.Exception.Message)" -ForegroundColor Red
    $errorCount++
  }

  Start-Sleep -Milliseconds 100  # Small delay to avoid API rate limits
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Upload Summary:" -ForegroundColor Cyan
Write-Host "✅ Successfully uploaded: $successCount parameters" -ForegroundColor Green
Write-Host "❌ Failed uploads: $errorCount parameters" -ForegroundColor Red
Write-Host "=====================================" -ForegroundColor Cyan

if ($errorCount -gt 0) {
  Write-Host ""
  Write-Host "⚠️  Some parameters failed to upload. Please check your AWS credentials and permissions." -ForegroundColor Yellow
  Write-Host "Required IAM permissions:" -ForegroundColor Yellow
  Write-Host "  - ssm:PutParameter" -ForegroundColor Yellow
  Write-Host "  - ssm:GetParameter" -ForegroundColor Yellow
  Write-Host "  - kms:Encrypt (if using SecureString parameters)" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "🎉 All environment variables uploaded successfully!" -ForegroundColor Green
Write-Host "Your Elastic Beanstalk application can now load these parameters using the .ebextensions configuration." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Deploy your application to Elastic Beanstalk" -ForegroundColor White
Write-Host "2. Ensure your Elastic Beanstalk instance role has SSM permissions" -ForegroundColor White
Write-Host "3. Monitor the deployment logs to verify parameters are loaded correctly" -ForegroundColor White
