#!/bin/bash

# =============================================================================
# Elastic Beanstalk Post-Deploy Hook: Rebuild Sharp Module
# =============================================================================

set -e  # Exit on critical command errors

echo "=========================================="
echo "🔧 Rebuilding Sharp Module for Amazon Linux"
echo "=========================================="
echo "Time: $(date)"
echo "Node.js Version: $(node --version)"
echo "NPM Version: $(npm --version)"
echo "Platform: $(uname -a)"
echo ""

# Navigate to the app directory
cd /var/app/current

echo "📂 Current directory: $(pwd)"
echo "📋 Checking for sharp in package.json..."

if grep -q '"sharp"' package.json; then
    echo "✅ Sharp is listed as a dependency"

    SHARP_VERSION=$(node -p "require('./package.json').dependencies.sharp" 2>/dev/null || echo "latest")
    echo "📦 Installing sharp@$SHARP_VERSION"

    echo "🗑️  Removing old sharp module (if exists)"
    rm -rf node_modules/sharp || true

    echo "🔧 Setting environment for native module rebuild"
    export npm_config_target_platform="linux"
    export npm_config_target_arch="x64"
    export npm_config_cache="/tmp/.npm"
    export npm_config_build_from_source="true"

    echo "📦 Reinstalling sharp..."
    npm install sharp@$SHARP_VERSION --verbose --no-save --production || true

    echo "✅ sharp installed, verifying..."
    if node -e "require('sharp')" 2>/dev/null; then
        echo "✅ Sharp loaded successfully"
    else
        echo "⚠️  Sharp did not load — proceeding anyway"
    fi

else
    echo "ℹ️  Sharp not in package.json — skipping rebuild"
fi

echo ""
echo "🧹 Cleaning up temp files"
rm -rf /tmp/.npm || true

echo "✅ Post-deploy sharp rebuild completed"
echo "Time: $(date)"
echo "=========================================="
echo ""

exit 0
