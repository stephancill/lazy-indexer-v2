#!/bin/bash

set -e

echo "🔨 Building Farcaster Indexer..."

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Build all packages in dependency order
echo "📦 Building shared package..."
cd "$PROJECT_ROOT/packages/shared" && bun run build

echo "📦 Building indexer package..."
cd "$PROJECT_ROOT/packages/indexer" && bun run build

echo "📦 Building API package..."
cd "$PROJECT_ROOT/packages/api" && bun run build

echo "📦 Building CLI package..."
cd "$PROJECT_ROOT/apps/cli" && bun run build

echo "📦 Building web interface..."
cd "$PROJECT_ROOT/apps/admin-web" && bun run build

cd "$PROJECT_ROOT"

echo "✅ Build complete!"