#!/bin/bash

set -e

echo "🚀 Deploying Farcaster Indexer..."

# Build everything first
echo "🔨 Building all packages..."
./scripts/build.sh

# Run tests
echo "🧪 Running tests..."
bun run test

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Build Docker images (this will be implemented in later days)
echo "🐳 Docker image building will be implemented in Day 10..."

echo "✅ Deployment preparation complete!"
echo ""
echo "Note: Full deployment with Docker images will be available after Day 10."