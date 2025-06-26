# =============================================================================
# Configuration Test Script for Windows PowerShell
# =============================================================================
# This script helps validate the Elastic Beanstalk configuration before deployment
# =============================================================================

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Configuration Test Script" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Test Node.js app configuration
Write-Host "Testing Node.js app configuration..." -ForegroundColor Yellow

if (Test-Path "package.json") {
    Write-Host "✅ Found package.json" -ForegroundColor Green
    
    if (Test-Path "src/app.js") {
        Write-Host "✅ Found src/app.js" -ForegroundColor Green
        
        # Check port configuration
        $portConfig = Select-String -Path "src/app.js" -Pattern "process\.env\.PORT \|\| 3000"
        if ($portConfig) {
            Write-Host "✅ Port configuration looks correct (port 3000)" -ForegroundColor Green
        } else {
            Write-Host "❌ Port configuration might be incorrect" -ForegroundColor Red
            Write-Host "   Expected: process.env.PORT || 3000" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ src/app.js not found" -ForegroundColor Red
    }
} else {
    Write-Host "❌ package.json not found" -ForegroundColor Red
}

Write-Host ""

# Test .ebextensions configuration
Write-Host "Testing .ebextensions configuration..." -ForegroundColor Yellow

if (Test-Path ".ebextensions/websocket.config") {
    Write-Host "✅ Found .ebextensions/websocket.config" -ForegroundColor Green
    
    # Check port configuration
    $ebPortConfig = Select-String -Path ".ebextensions/websocket.config" -Pattern "PORT: 3000"
    if ($ebPortConfig) {
        Write-Host "✅ PORT environment variable set to 3000" -ForegroundColor Green
    } else {
        Write-Host "❌ PORT environment variable configuration issue" -ForegroundColor Red
    }
    
    # Check nginx configuration
    $nginxConfig = Select-String -Path ".ebextensions/websocket.config" -Pattern "server 127\.0\.0\.1:3000"
    if ($nginxConfig) {
        Write-Host "✅ Nginx upstream configuration looks correct" -ForegroundColor Green
    } else {
        Write-Host "❌ Nginx upstream configuration might be incorrect" -ForegroundColor Red
    }
    
    # Check for sharp dependency
    $sharpDep = Select-String -Path "package.json" -Pattern '"sharp"'
    if ($sharpDep) {
        Write-Host "✅ Sharp dependency found in package.json" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  Sharp dependency not found in package.json" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ .ebextensions/websocket.config not found" -ForegroundColor Red
}

Write-Host ""

# Test deployment hooks
Write-Host "Testing deployment hooks..." -ForegroundColor Yellow

if (Test-Path ".platform/hooks/postdeploy/01_rebuild_sharp.sh") {
    Write-Host "✅ Found sharp rebuild hook" -ForegroundColor Green
} else {
    Write-Host "❌ Sharp rebuild hook not found" -ForegroundColor Red
}

if (Test-Path ".platform/hooks/predeploy/01_install_build_tools.sh") {
    Write-Host "✅ Found build tools installation hook" -ForegroundColor Green
} else {
    Write-Host "❌ Build tools installation hook not found" -ForegroundColor Red
}

if (Test-Path ".ebignore") {
    Write-Host "✅ Found .ebignore file" -ForegroundColor Green
    
    # Check if node_modules is excluded
    $nodeModulesIgnored = Select-String -Path ".ebignore" -Pattern "node_modules/"
    if ($nodeModulesIgnored) {
        Write-Host "   ✅ node_modules/ excluded from deployment" -ForegroundColor Green
    } else {
        Write-Host "   ❌ node_modules/ not excluded (may cause sharp issues)" -ForegroundColor Red
    }
} else {
    Write-Host "❌ .ebignore file not found" -ForegroundColor Red
}

Write-Host ""

# Test application startup
Write-Host "Testing application startup..." -ForegroundColor Yellow

if (Test-Path "node_modules") {
    Write-Host "✅ node_modules found" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔍 You can test the application by running:" -ForegroundColor Cyan
    Write-Host "   `$env:NODE_ENV='production'" -ForegroundColor White
    Write-Host "   `$env:PORT='3000'" -ForegroundColor White
    Write-Host "   npm start" -ForegroundColor White
    Write-Host ""
    Write-Host "   Then in another PowerShell window:" -ForegroundColor Cyan
    Write-Host "   curl http://localhost:3000/health" -ForegroundColor White
    Write-Host "   curl http://localhost:3000/ping" -ForegroundColor White
    Write-Host ""
    
    # Ask if user wants to run a quick test
    $response = Read-Host "Would you like to run a quick health check test? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host "🔄 Starting quick health check test..." -ForegroundColor Yellow
        
        # Set environment variables
        $env:NODE_ENV = "production"
        $env:PORT = "3000"
        
        Write-Host "   Starting Node.js app on port 3000..." -ForegroundColor Cyan
        
        # Start the app in background
        $job = Start-Job -ScriptBlock { 
            Set-Location $using:PWD
            $env:NODE_ENV = "production"
            $env:PORT = "3000"
            npm start 
        }
        
        # Wait for startup
        Start-Sleep -Seconds 5
        
        # Test health endpoints
        Write-Host "   Testing health endpoints..." -ForegroundColor Cyan
        
        try {
            $healthResponse = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get -TimeoutSec 5
            Write-Host "✅ Health endpoint responded" -ForegroundColor Green
            Write-Host "   Response: $($healthResponse | ConvertTo-Json -Compress)" -ForegroundColor Gray
        } catch {
            Write-Host "❌ Health endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        try {
            $pingResponse = Invoke-RestMethod -Uri "http://localhost:3000/ping" -Method Get -TimeoutSec 5
            Write-Host "✅ Ping endpoint responded: $pingResponse" -ForegroundColor Green
        } catch {
            Write-Host "❌ Ping endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        # Test sharp module if available
        Write-Host "   Testing sharp module..." -ForegroundColor Cyan
        try {
            Invoke-RestMethod -Uri "http://localhost:3000/api/test" -Method Get -TimeoutSec 5 | Out-Null
            Write-Host "✅ API endpoint accessible for sharp testing" -ForegroundColor Green
        } catch {
            Write-Host "❌ Could not access API for sharp testing: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        # Stop the background job
        Write-Host "   Stopping test app..." -ForegroundColor Yellow
        Stop-Job $job
        Remove-Job $job
        Write-Host "   Test completed" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  node_modules not found. Run 'npm install' first" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Configuration Test Summary" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Checklist for Elastic Beanstalk deployment:" -ForegroundColor Green
Write-Host "   ✓ Nginx listens on port 80 (handled by EB)" -ForegroundColor White
Write-Host "   ✓ Node.js app runs on port 3000" -ForegroundColor White
Write-Host "   ✓ Health checks available at /health and /ping" -ForegroundColor White
Write-Host "   ✓ Types hash configuration included" -ForegroundColor White
Write-Host "   ✓ WebSocket support configured" -ForegroundColor White
Write-Host "   ✓ Sharp module rebuild hooks configured" -ForegroundColor White
Write-Host "   ✓ node_modules/ excluded from deployment" -ForegroundColor White
Write-Host ""
Write-Host "🚀 If all tests pass, your app should deploy successfully!" -ForegroundColor Green
Write-Host "   Monitor deployment logs for:" -ForegroundColor Yellow
Write-Host "   - Hook execution messages" -ForegroundColor Gray
Write-Host "   - Sharp rebuild progress" -ForegroundColor Gray
Write-Host "   - /var/log/nginx/error.log and /tmp/sample-app.log" -ForegroundColor Gray
Write-Host "" 