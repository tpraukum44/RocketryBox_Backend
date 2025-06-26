#!/bin/bash

# =============================================================================
# Fix Permissions for Deployment Hooks
# =============================================================================
# Ensures all hook scripts have proper execution permissions
# =============================================================================

echo "🔧 Fixing permissions for deployment hooks..."

# Fix permissions for platform hooks
if [ -d "/var/app/current/.platform/hooks" ]; then
    echo "   📁 Found .platform/hooks directory"
    
    # Make all hook scripts executable
    find /var/app/current/.platform/hooks -name "*.sh" -type f -exec chmod +x {} \;
    echo "   ✅ Set executable permissions for all .sh files in hooks"
    
    # List the hooks for verification
    echo "   📋 Available hooks:"
    find /var/app/current/.platform/hooks -name "*.sh" -type f | while read file; do
        echo "      $(basename "$file") ($(stat -c %a "$file"))"
    done
else
    echo "   ℹ️  No .platform/hooks directory found"
fi

echo "   ✅ Permission fix completed" 