# PowerShell script to run delivery partner tests
# Run this script from the backend directory

param(
  [switch]$Direct,
  [string]$Partner
)

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "DELIVERY PARTNER TEST RUNNER" -ForegroundColor Yellow
Write-Host "============================================`n" -ForegroundColor Cyan

# Check if we're in the correct directory
if (!(Test-Path "package.json")) {
  Write-Host "Error: This script must be run from the backend directory" -ForegroundColor Red
  Write-Host "Please navigate to the backend directory and run again." -ForegroundColor Red
  exit 1
}

# Function to display menu
function Show-Menu {
  Write-Host "Select test option:" -ForegroundColor Green
  Write-Host "1. Run all delivery partner tests" -ForegroundColor White
  Write-Host "2. Run BlueDart tests only" -ForegroundColor White
  Write-Host "3. Run EcomExpress tests only" -ForegroundColor White
  Write-Host "4. Run Ekart tests only" -ForegroundColor White
  Write-Host "5. Run Delhivery tests only" -ForegroundColor White
  Write-Host "6. Run XpressBees tests only" -ForegroundColor White
  Write-Host "7. Exit" -ForegroundColor White
  Write-Host ""
}

# Function to run tests
function Invoke-Tests {
  param($TestFile, $TestName)

  Write-Host "`nRunning $TestName..." -ForegroundColor Yellow
  Write-Host "============================================`n" -ForegroundColor Cyan

  try {
    node $TestFile

    if ($LASTEXITCODE -eq 0) {
      Write-Host "`n✅ $TestName completed successfully!" -ForegroundColor Green
    }
    else {
      Write-Host "`n❌ $TestName failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    }
  }
  catch {
    Write-Host "`n❌ Error running $TestName : $_" -ForegroundColor Red
  }

  Write-Host "`nPress any key to continue..." -ForegroundColor Yellow
  $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Main loop
do {
  Clear-Host
  Write-Host "`n============================================" -ForegroundColor Cyan
  Write-Host "DELIVERY PARTNER TEST RUNNER" -ForegroundColor Yellow
  Write-Host "============================================`n" -ForegroundColor Cyan

  Show-Menu
  $choice = Read-Host "Enter your choice (1-7)"

  switch ($choice) {
    "1" {
      Invoke-Tests "tests/delivery-partners/run-all-tests.js" "All Delivery Partner Tests"
    }
    "2" {
      Invoke-Tests "tests/delivery-partners/test-bluedart.js" "BlueDart Tests"
    }
    "3" {
      Invoke-Tests "tests/delivery-partners/test-ecomexpress.js" "EcomExpress Tests"
    }
    "4" {
      Invoke-Tests "tests/delivery-partners/test-ekart.js" "Ekart Tests"
    }
    "5" {
      Invoke-Tests "tests/delivery-partners/test-delhivery.js" "Delhivery Tests"
    }
    "6" {
      Invoke-Tests "tests/delivery-partners/test-xpressbees.js" "XpressBees Tests"
    }
    "7" {
      Write-Host "`nExiting test runner. Goodbye!" -ForegroundColor Green
      break
    }
    default {
      Write-Host "`nInvalid choice. Please try again." -ForegroundColor Red
      Start-Sleep -Seconds 2
    }
  }
} while ($choice -ne "7")

# Additional options for CI/CD or direct execution
# To run specific tests directly from command line:
# .\run-tests.ps1 -Direct -Partner "bluedart"

if ($Direct) {
  switch ($Partner.ToLower()) {
    "all" {
      node tests/delivery-partners/run-all-tests.js
      exit $LASTEXITCODE
    }
    "bluedart" {
      node tests/delivery-partners/test-bluedart.js
      exit $LASTEXITCODE
    }
    "ecomexpress" {
      node tests/delivery-partners/test-ecomexpress.js
      exit $LASTEXITCODE
    }
    "ekart" {
      node tests/delivery-partners/test-ekart.js
      exit $LASTEXITCODE
    }
    "delhivery" {
      node tests/delivery-partners/test-delhivery.js
      exit $LASTEXITCODE
    }
    "xpressbees" {
      node tests/delivery-partners/test-xpressbees.js
      exit $LASTEXITCODE
    }
    default {
      Write-Host "Invalid partner name. Use: all, bluedart, ecomexpress, ekart, delhivery, or xpressbees" -ForegroundColor Red
      exit 1
    }
  }
}
