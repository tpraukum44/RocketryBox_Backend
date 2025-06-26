#!/bin/bash

# Rebuild sharp module for Amazon Linux platform
# This ensures sharp works correctly on the target environment

echo "Rebuilding native modules for Amazon Linux..."

# Navigate to the application directory
cd /var/app/staging

# Check if package.json exists and contains sharp
if [ -f "package.json" ] && grep -q "sharp" package.json; then
    echo "Sharp module detected, rebuilding for Amazon Linux..."
    
    # Rebuild sharp for the correct platform and architecture
    npm rebuild sharp --platform=linux --arch=x64
    
    echo "Sharp module rebuild completed"
else
    echo "Sharp module not found in package.json, skipping rebuild"
fi

# Rebuild other native modules that might need platform-specific compilation
echo "Rebuilding bcrypt module..."
if grep -q "bcrypt" package.json; then
    npm rebuild bcrypt --platform=linux --arch=x64
    echo "Bcrypt module rebuild completed"
fi

# Rebuild any other native modules
echo "Rebuilding all native modules for current platform..."
npm rebuild

echo "All native modules rebuild completed" 