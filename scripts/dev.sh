#!/bin/bash

set -e

echo "🚀 Setting up Farcaster Indexer development environment..."

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Please install Bun first: https://bun.sh/"
    exit 1
fi

# Check if docker and docker-compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file with default values..."
    cat > .env << EOF
# Development
DATABASE_URL=postgres://postgres:password@localhost:5432/postgres
REDIS_HOST=localhost
REDIS_PORT=6379

# Testing
TEST_DATABASE_URL=postgres://postgres:password@localhost:5433/postgres_test
TEST_REDIS_HOST=localhost
TEST_REDIS_PORT=6380

# Authentication
JWT_SECRET=your-secret-key-here-change-this-in-production-minimum-32-characters
ADMIN_PASSWORD=admin-password-123

# Farcaster API
NEYNAR_API_KEY=your-neynar-api-key

# Concurrency
BACKFILL_CONCURRENCY=5
REALTIME_CONCURRENCY=1
EOF
    echo "✅ Created .env file. Please update it with your actual values."
else
    echo "✅ .env file already exists."
fi

# Install dependencies
echo "📦 Installing dependencies..."
bun install

# Start Docker services
echo "🐳 Starting Docker services (PostgreSQL and Redis)..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check if services are running
if ! docker-compose ps | grep postgres | grep -q "Up"; then
    echo "❌ PostgreSQL is not running. Check docker-compose logs."
    exit 1
fi

if ! docker-compose ps | grep redis | grep -q "Up"; then
    echo "❌ Redis is not running. Check docker-compose logs."
    exit 1
fi

echo "✅ PostgreSQL is running on port 5432"
echo "✅ Redis is running on port 6379"
echo "✅ Test PostgreSQL is running on port 5433"
echo "✅ Test Redis is running on port 6380"

# Build shared package
echo "🔨 Building shared package..."
cd packages/shared && bun run build && cd ../..

# Run tests to verify everything is working
echo "🧪 Running tests to verify setup..."
cd packages/shared && bun run test && cd ../..

echo ""
echo "🎉 Development environment is ready!"
echo ""
echo "Available commands:"
echo "  bun run dev                 - Start all services in development mode"
echo "  bun run dev:indexer         - Start indexer service only"
echo "  bun run dev:api             - Start API service only"
echo "  bun run dev:web             - Start web interface only"
echo "  bun run test                - Run all tests"
echo "  bun run build               - Build all packages"
echo "  docker-compose logs         - View service logs"
echo "  docker-compose down         - Stop all services"
echo ""
echo "Next steps:"
echo "1. Update .env file with your Neynar API key"
echo "2. Run 'bun run dev' to start development servers"
echo "3. Open http://localhost:3000 for API and http://localhost:5173 for web interface"