# Farcaster Indexer

A high-performance, configurable indexer for the Farcaster decentralized social network that enables efficient querying and analysis of Farcaster data.

## 🚀 Quick Start

```bash
# Setup development environment
bun run setup

# Start all services
bun run dev

# Run tests
bun run test

# Build all packages
bun run build
```

## 📁 Project Structure

This is a monorepo with the following structure:

```
├── packages/
│   ├── shared/           # Shared libraries and utilities
│   ├── indexer/          # Core indexing service
│   └── api/              # API server
├── apps/
│   ├── admin-web/        # Admin web interface
│   └── cli/              # Command-line tools
└── scripts/              # Development and deployment scripts
```

## 🛠 Development

### Prerequisites

- [Bun](https://bun.sh/) (latest version)
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- PostgreSQL and Redis (provided via Docker Compose)

### Docker Services

The project uses two Docker Compose files:

- `docker-compose.yml` - Development services (PostgreSQL, Redis)
- `docker-compose.test.yml` - Test services (separate PostgreSQL and Redis instances)

### Environment Setup

1. Clone the repository
2. Run `bun run setup` to initialize the development environment
3. Update `.env` file with your configuration (especially the Neynar API key)
4. Start development servers with `bun run dev`

### Available Scripts

- `bun run setup` - Initialize development environment
- `bun run dev` - Start all services in development mode
- `bun run dev:indexer` - Start indexer service only
- `bun run dev:api` - Start API service only
- `bun run dev:web` - Start web interface only
- `bun run test` - Run all tests
- `bun run test:watch` - Run tests in watch mode
- `bun run test:coverage` - Generate test coverage reports
- `bun run build` - Build all packages
- `bun run lint` - Check code with Biome
- `bun run lint:fix` - Fix code issues with Biome
- `bun run format` - Format code with Biome
- `bun run clean` - Remove all build artifacts and dependencies

## 🏗 Architecture

The Farcaster Indexer uses a lazy, target-based indexing strategy that focuses only on relevant data to minimize storage and processing overhead while filtering out network spam.

### Core Components

1. **Configuration System** (`packages/shared/src/config.ts`)

   - Centralized configuration management
   - Environment variable support
   - Validation with Zod schemas

2. **Type Definitions** (`packages/shared/src/types.ts`)

   - Comprehensive TypeScript interfaces
   - Farcaster message and event types
   - API response types

3. **Hub Client** (Coming in Day 2)

   - Resilient communication with Farcaster hubs
   - Automatic fallback between multiple hubs
   - Request transformation for API keys

4. **Database Layer** (Coming in Day 2)

   - PostgreSQL with Drizzle ORM
   - Optimized schema for Farcaster data
   - Migration system

5. **Job Queue** (Coming in Day 3)

   - BullMQ for background task management
   - Backfill and real-time sync workers
   - Job monitoring with BullBoard

6. **API Server** (Coming in Day 5)

   - Hono-based REST API
   - JWT authentication
   - Public and admin endpoints

7. **Admin Interface** (Coming in Day 8)
   - React-based web interface
   - Target management
   - Job monitoring dashboard

### Target-Based Indexing Strategy

The indexer maintains a dynamic list of "target" FIDs and only processes events related to them:

- **Root Targets**: Initial set of important FIDs to index
- **Graph Expansion**: Automatically follows the social graph from root targets
- **Client Discovery**: Monitors specific client FIDs for new user discovery
- **Dynamic Updates**: Real-time addition/removal of targets based on follows/unfollows

## 🧪 Testing

The project uses Vitest for testing with comprehensive coverage:

- **Unit Tests**: Individual function and class testing
- **Integration Tests**: Component interaction testing
- **Load Tests**: Performance and scalability testing
- **Chaos Tests**: Failure scenario testing

### Test Environment Setup

Before running tests, start the test services:

```bash
# Start test database and Redis
docker-compose -f docker-compose.test.yml up -d
```

Run tests with:

```bash
bun run test                # All tests
bun run test:watch         # Watch mode
bun run test:coverage      # With coverage
bun run test:integration   # Integration tests only
bun run test:load         # Load tests only
```

For detailed testing instructions, see [TESTING.md](docs/TESTING.md).

## 📝 Configuration

The system is configured via environment variables or the default configuration in `packages/shared/src/config.ts`:

### Environment Variables

```bash
# Database
DATABASE_URL=postgres://postgres:password@localhost:5432/postgres
TEST_DATABASE_URL=postgres://postgres:password@localhost:5433/postgres_test

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
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
```

## 📚 Documentation

- [Context](docs/CONTEXT.md) - Background on Farcaster and project requirements
- [Specification](docs/SPECIFICATION.md) - Detailed technical specification
- [Implementation Plan](docs/PLAN.md) - 10-day development roadmap

## 🤝 Contributing

1. Follow the established code style (enforced by Biome)
2. Write tests for new functionality
3. Update documentation as needed
4. Use conventional commit messages

## 📄 License

[Add your license here]

## 🛣 Roadmap

This project follows a 10-day implementation plan:

- ✅ **Day 1**: Project setup, monorepo structure, configuration system
- 🔄 **Day 2**: Database layer and hub client
- 📅 **Day 3**: Job queue infrastructure and workers
- 📅 **Day 4**: Real-time sync and event processing
- 📅 **Day 5**: API server foundation
- 📅 **Day 6**: Admin API and target management
- 📅 **Day 7**: CLI tools and migration scripts
- 📅 **Day 8**: Admin web interface
- 📅 **Day 9**: Integration testing and performance optimization
- 📅 **Day 10**: Documentation and deployment preparation

## 🆘 Support

For questions, issues, or contributions, please refer to the project documentation or create an issue in the repository.
