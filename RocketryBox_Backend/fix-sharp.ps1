#!/usr/bin/env pwsh

# Fix Sharp Installation Script for RocketryBox Backend
# This script helps resolve Sharp installation issues across different platforms

Write-Host "🔧 Sharp Installation Fix Script" -ForegroundColor Yellow
Write-Host "=================================" -ForegroundColor Yellow

# Check if we're in the correct directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Please run this script from the project root." -ForegroundColor Red
    exit 1
}

# Remove existing Sharp installation
Write-Host "🗑️  Removing existing Sharp installation..." -ForegroundColor Blue
npm uninstall sharp

# Clear npm cache
Write-Host "🧹 Clearing npm cache..." -ForegroundColor Blue
npm cache clean --force

# Reinstall Sharp with optional dependencies
Write-Host "📦 Installing Sharp with optional dependencies..." -ForegroundColor Blue
npm install --include=optional sharp

# For Linux deployment, also install platform-specific version
Write-Host "🐧 Installing Linux x64 specific Sharp binaries..." -ForegroundColor Blue
npm install --platform=linux --arch=x64 sharp

# Rebuild Sharp
Write-Host "🔨 Rebuilding Sharp..." -ForegroundColor Blue
npm rebuild sharp

# Test Sharp installation
Write-Host "🧪 Testing Sharp installation..." -ForegroundColor Blue
node -e "
try {
    const sharp = require('sharp');
    console.log('✅ Sharp installed successfully!');
    console.log('📋 Sharp version:', sharp.versions.sharp);
    console.log('📋 libvips version:', sharp.versions.vips);
} catch (error) {
    console.error('❌ Sharp installation failed:', error.message);
    process.exit(1);
}
"

Write-Host "✅ Sharp installation fix completed!" -ForegroundColor Green
Write-Host "💡 If you still encounter issues, check the Sharp documentation:" -ForegroundColor Cyan
Write-Host "   https://sharp.pixelplumbing.com/install" -ForegroundColor Cyan 