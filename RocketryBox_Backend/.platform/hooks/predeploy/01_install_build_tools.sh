#!/bin/bash

# =============================================================================
# Elastic Beanstalk Pre-Deploy Hook: Install Build Tools (Fixed)
# =============================================================================

set -e  # Exit on any error

echo "=========================================="
echo "🔧 Installing Build Tools for Native Modules"
echo "=========================================="
echo "Time: $(date)"
echo "Platform: $(uname -a)"
echo ""

# Update package manager
echo "📦 Updating package manager..."
if command -v yum >/dev/null 2>&1; then
    echo "   Using yum (Amazon Linux 2)"
    sudo yum update -y >/dev/null 2>&1 || echo "   Warning: yum update had issues"
    sudo yum groupinstall -y "Development Tools" >/dev/null 2>&1 || echo "   Warning: Dev Tools group install failed"
    sudo yum install -y gcc-c++ make python3 python3-pip >/dev/null 2>&1 || echo "   Warning: Some tools failed"
    sudo yum install -y vips vips-devel libvips libvips-devel >/dev/null 2>&1 || echo "   Note: sharp may compile from source"

elif command -v dnf >/dev/null 2>&1; then
    echo "   Using dnf"
    sudo dnf update -y >/dev/null 2>&1 || echo "   Warning: dnf update had issues"
    sudo dnf groupinstall -y "Development Tools" >/dev/null 2>&1 || echo "   Warning: Dev Tools group install failed"
    sudo dnf install -y gcc-c++ make python3 python3-pip vips vips-devel >/dev/null 2>&1 || echo "   Note: sharp may compile from source"

elif command -v apt-get >/dev/null 2>&1; then
    echo "   Using apt-get"
    sudo apt-get update >/dev/null 2>&1 || echo "   Warning: apt update had issues"
    sudo apt-get install -y build-essential python3 python3-pip libvips-dev >/dev/null 2>&1 || echo "   Note: sharp may compile from source"

else
    echo "⚠️  Unknown package manager — skipping tool install"
fi

# Verify toolchain
echo ""
echo "🧪 Verifying tools..."
for cmd in gcc g++ make python3; do
  if command -v $cmd >/dev/null 2>&1; then
    echo "   ✅ $cmd found: $($cmd --version | head -n 1)"
  else
    echo "   ❌ $cmd not found"
  fi
done

if command -v vips >/dev/null 2>&1; then
    echo "   ✅ vips: $(vips --version 2>/dev/null | head -n1 || echo 'available')"
else
    echo "   ℹ️  vips not found (sharp will compile libvips from source)"
fi

# Safe: store environment setup in /tmp (not EB's internal dir)
echo ""
echo "🔧 Writing build environment to /tmp/build_env.sh"
cat << 'EOF' > /tmp/build_env.sh
export CC=gcc
export CXX=g++
export MAKE=make
export PYTHON=/usr/bin/python3
export npm_config_build_from_source=true
export npm_config_cache=/tmp/.npm
EOF

chmod +x /tmp/build_env.sh
echo "   ✅ Build env saved to /tmp/build_env.sh"

echo ""
echo "🏁 Build tools installation completed"
echo "Time: $(date)"
echo "=========================================="
