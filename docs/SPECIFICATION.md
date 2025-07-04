# Farcaster Indexer Specification

This document outlines the technical specification for the Farcaster Indexer project.

## 1. Overview

The project is to build a service that indexes Farcaster network data into a PostgreSQL database. This allows for the creation of efficient and complex queries that are not possible with the default Farcaster Hub APIs (e.g., generating user feeds).

The indexer will be configurable, resilient, and support both backfilling of historical data and real-time updates.

## 2. System Architecture

The indexer is composed of several key components:

- **Configuration**: A TypeScript file (`src/config.ts`) defines the indexing criteria.
- **Hub Client**: A resilient client to communicate with Farcaster Hubs via HTTP, handling fallbacks and API keys.
- **Job Queue (BullMQ)**: Manages all background tasks like backfilling and real-time data processing, backed by Redis.
- **Workers**: Processes that execute the jobs defined in the queue.
- **Database (Postgres/Drizzle)**: Stores the indexed Farcaster data.
- **API (Hono)**: An optional API server to expose the indexed data.
- **Main Process**: The entry point (`src/index.ts`) that initializes and starts the workers and optionally the API server.

```
+-------------------+      +------------------+      +---------------------+
| Farcaster Hubs    |<---->|   Hub Client     |<---->|   BullMQ Workers    |
| (HTTP API)        |      | (Fallback Logic) |      | (Backfill/Realtime) |
+-------------------+      +------------------+      +----------+----------+
                                                                |
                                                                v
                                                      +---------+---------+
                                                      |      Redis        |
                                                      |     (BullMQ)      |
                                                      +-------------------+
                                                                |
                                                                v
                                                      +---------+---------+
                                                      |    PostgreSQL     |
                                                      |     (Drizzle)     |
                                                      +-------------------+
                                                                ^
                                                                |
                                                      +---------+---------+
                                                      |    API Server     |<----+
                                                      |      (Hono)       |     |
                                                      +-------------------+     |
                                                                ^               |
                                                                |               |
                                                      +---------+---------+     |
                                                      |   Admin Web UI    |     |
                                                      |   (React/Vite)    |     |
                                                      +-------------------+     |
                                                                                |
                                                      +---------+---------+     |
                                                      |   CLI Tools       |-----+
                                                      |   (Commands)      |
                                                      +-------------------+
```

## 3. Configuration (`src/config.ts`)

A central configuration file will manage the indexer's behavior.

```typescript
// src/config.ts
export const config = {
  // List of hub endpoints to use, in order of preference.
  // The client will fall back to the next one on failure.
  hubs: [
    {
      url: "https://hub.merv.fun",
    },
    {
      url: "https://snapchain-api.neynar.com",
      transformRequest: (init: RequestInit) => ({
        ...init,
        headers: {
          ...init.headers,
          "x-api-key": process.env.NEYNAR_API_KEY || "YOUR_NEYNAR_API_KEY",
        },
      }),
    },
  ],

  // Configuration for the lazy, target-based indexing strategy.
  strategy: {
    // A list of initial FIDs to act as "root targets".
    // These can be managed via a script or directly in the database.
    rootTargets: [1, 2, 3], // Example FIDs for initial seeding

    // A list of client FIDs to monitor for discovering new root targets.
    // When users from these clients sign up, they become new root targets.
    targetClients: [4, 5, 6], // Example client FIDs to monitor

    // Whether to enable dynamic discovery of new root targets from client apps.
    enableClientDiscovery: true,
  },

  // Redis connection info for BullMQ
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
  },

  // Postgres connection info for Drizzle
  postgres: {
    connectionString:
      process.env.DATABASE_URL || "postgres://user:password@host:port/db",
  },

  // Authentication settings
  auth: {
    jwtSecret: process.env.JWT_SECRET || "your-secret-key-here",
    adminPassword: process.env.ADMIN_PASSWORD || "admin-password-123",
  },

  // Concurrency settings for background jobs
  concurrency: {
    backfill: 5,
    realtime: 1,
  },
};
```

## 4. Hub Client (`src/libs/hub-client.ts`)

This module will be responsible for all communication with Farcaster hubs.

- **Resilience**: It will accept an array of hub configurations. If a request to the primary hub fails (e.g., network error, rate limit), it will automatically retry with the next hub in the list.
- **HTTP Only**: It will use the native `fetch` API for all HTTP requests, as specified.
- **Request Transformation**: It will use each hub's `transformRequest` function to modify the `RequestInit` object before making requests, allowing for flexible authentication and header manipulation.
- **Pagination**: It will handle paginated endpoints by transparently fetching all pages or returning a `nextPageToken` for manual control.

## 5. Database Schema (`src/db/schema.ts`)

We will use Drizzle ORM to define the schema. The core tables will be:

- **`targets`**: Manages the set of FIDs to be indexed.
  - `fid` (PK), `is_root` (boolean), `added_at`, `last_synced_at` (nullable, timestamp).
- **`users`**: Stores user profile data.
  - `fid` (PK), `username`, `display_name`, `pfp_url`, `bio`, `custody_address`, `synced_at`.
- **`casts`**: Stores cast messages.
  - `hash` (PK), `fid`, `text`, `parent_hash`, `parent_fid`, `timestamp`, `embeds`, `parent_url`.
- **`reactions`**: Stores likes and recasts.
  - `hash` (PK), `fid`, `type` ('like' or 'recast'), `target_hash`, `timestamp`.
- **`links`**: Stores follows.
  - `hash` (PK), `fid`, `target_fid`, `type` ('follow'), `timestamp`.
- **`verifications`**: Stores verified addresses.
  - `hash` (PK), `fid`, `address`, `protocol` ('ethereum'), `timestamp`.
- **`target_clients`**: Stores the client FIDs to monitor for discovering new root targets.
  - `client_fid` (PK), `added_at`.

## 6. Data Sync Strategy

The indexer employs a lazy, target-based strategy to focus only on relevant data and aggressively filter out network spam. It maintains a dynamic list of "target" FIDs and only processes events related to them.

### Initialization & Target Management

- **Initial Targets**: On startup, the indexer will additively populate the `targets` table in the database with the `rootTargets` defined in `src/config.ts`, marking them with `is_root = true`. This operation only adds new targets that don't already exist - it does not remove existing targets that are no longer in the config.
- **Target Clients**: On startup, the indexer will additively populate the `target_clients` table in the database with the `targetClients` defined in `src/config.ts`. This operation only adds new client FIDs that don't already exist - it does not remove existing client FIDs that are no longer in the config.
- **Target Set Cache**: For fast, real-time lookups, the set of all FIDs from the `targets` table is loaded into a Redis set. This cache is kept in sync with the `targets` table.
- **Client Set Cache**: Similarly, the set of client FIDs from the `target_clients` table is loaded into a Redis set to allow for efficient checking during event processing.

### Backfilling

- **Trigger**: Backfilling is triggered for any FID in the `targets` table where `last_synced_at` is `NULL`. This can be initiated via a script (`bun run backfill`) that scans for unsynced targets.
- **Mechanism**: A `backfill-target` job is created for each target requiring a backfill.
- **Process**:
  - The `backfill-target` worker fetches all historical messages (`casts`, `links`, etc.) for the given FID in a single, atomic operation. Since fetching data for a single FID is quick, we don't need complex resumability. If a job fails, it can be safely retried.
  - **Graph Expansion**: If the target being backfilled is a _root target_ (`is_root = true`), the worker will also fetch all of their `follow` links. For each followed user (`target_fid`), it will add them to the `targets` table (with `is_root = false`) if they don't already exist. This will automatically queue a `backfill-target` job for the new user.
- **Completion**: Once all data for an FID is successfully fetched and stored, the `last_synced_at` timestamp in the `targets` table is updated to the current time.

### Real-time Sync & Dynamic Expansion

- **Mechanism**: A recurring `realtime-sync` job polls the `/v1/events` endpoint, just as before.
- **Event Filtering**: An incoming event is only processed if it meets one of the following criteria (checked efficiently against the Redis target set):
  - The event's `fid` is in the Redis target set.
  - It's a `cast` that is a reply to a cast created by a target (`parent_fid` is a target).
  - It's a `reaction` where the `target_hash` belongs to a cast created by a target.
  - It's a `link` (follow) where the `target_fid` is a target.
- **Dynamic Expansion in Real-time**:
  1.  **Follows & Unfollows**:
      - If a `LINK` event (type: `follow`) is processed where the `fid` is a _root target_, the `target_fid` is immediately added to the `targets` table in Postgres and the target set in Redis. A `backfill-target` job is then queued for them.
      - Conversely, if a `LINK` event (type: `unfollow`) is processed where the `fid` is a _root target_, the system first checks if any other root targets are still following the `target_fid`. If no other root targets are following them, the `target_fid` is removed from the `targets` table and the Redis set, effectively stopping any further indexing of their activity. A cleanup job can be triggered to remove their historical data to save space.
  2.  **App-based Discovery**: If an `ON_CHAIN_EVENT` (type: `SIGNER`) is processed, the worker checks if the signer's `fid` matches a client FID in the Redis client set. If there's a match, the user's `fid` is added to the `targets` table as a _new root target_ (`is_root = true`) and to the Redis target set. A `backfill-target` job is then queued.
- **Processing**: Valid events are batched and saved to the database to maintain efficiency.

## 7. Job Queue (BullMQ)

We will define several queues and workers to handle the indexing tasks.

- **`backfillQueue`**:
  - `backfill-target`: Job to fetch all historical data for a single target FID and expand the graph if it's a root target.
- **`realtimeQueue`**:
  - `realtime-sync`: Recurring job to poll for new events, filter them against the target list, and dynamically expand the target graph.

## 8. API (`src/api/server.ts`)

A Hono-based API server can be built to expose the indexed data and provide admin functionality for managing targets.

### Public API Endpoints:

- `GET /v1/feed/:fid`: Returns a chronological feed of casts from users that the given FID follows.
- `GET /v1/casts/:hash`: Get a cast by its hash.
- `GET /v1/users/:fid`: Get a user's profile.

### Authentication

The API uses JWT-based authentication for admin endpoints via HTTP-only cookies:

- `POST /auth/login`: Login endpoint that accepts a password and sets a JWT token in an HTTP-only cookie.
  - Request body: `{ "password": "admin-password-123" }`
  - Response: `{ "success": true }` with `Set-Cookie: token=jwt-token-here; HttpOnly; Secure; SameSite=Strict`
- `POST /auth/logout`: Logout endpoint that clears the authentication cookie.
  - Response: `{ "success": true }` with `Set-Cookie: token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
- Admin endpoints require a valid JWT token in the `token` cookie

### Admin API Endpoints:

All admin endpoints require authentication via JWT token.

- `GET /admin/targets`: List all targets with pagination, filtering, and sorting options.
- `POST /admin/targets`: Add a new target (root or non-root).
- `PUT /admin/targets/:fid`: Update a target's properties (e.g., promote/demote root status).
- `DELETE /admin/targets/:fid`: Remove a target from indexing.
- `POST /admin/targets/:fid/backfill`: Trigger a backfill job for a specific target.
- `GET /admin/targets/:fid/stats`: Get statistics for a target (cast count, followers, etc.).
- `GET /admin/client-targets`: List all client FIDs being monitored.
- `POST /admin/client-targets`: Add a new client FID to monitor.
- `DELETE /admin/client-targets/:fid`: Remove a client FID from monitoring.
- `GET /admin/jobs`: Get status of background jobs (backfill, realtime sync).
- `POST /admin/jobs/backfill`: Trigger a full backfill for all unsynced targets.

All admin operations that modify targets or client targets will automatically sync changes with the Redis cache to ensure real-time consistency.

### Admin Web Interface:

A modern web interface will be served by the API server to provide a user-friendly way to manage targets. The interface will include:

- **Dashboard**: Overview of indexing status, target counts, and job queue statistics.
- **Target Management**: Add, remove, and modify targets with search and filtering capabilities.
- **Client Monitoring**: Manage client FIDs for automatic root target discovery.
- **Job Monitoring**: View and manage background jobs, trigger manual backfills.
- **Analytics**: Visual insights into indexing performance and target statistics.

The admin interface will be accessible at `/admin` and will use the admin API endpoints for all operations.

## 9. Testing Strategy

The project will use Vitest for comprehensive testing across all components. Each package and app will have its own test suite with shared testing utilities.

### Test Types:

1. **Unit Tests**: Test individual functions and classes in isolation

   - Core business logic (target management, event processing)
   - Database operations (CRUD operations, queries)
   - Hub client functionality (API calls, fallback logic)
   - Configuration and utilities

2. **Integration Tests**: Test component interactions

   - Database and Redis integration
   - API endpoint functionality
   - Job queue operations
   - End-to-end data flow

3. **Load Tests**: Simulate high-volume scenarios

   - Concurrent job processing
   - API endpoint performance
   - Database query optimization
   - Redis cache performance

4. **Chaos Tests**: Test failure scenarios
   - Hub API failures and fallbacks
   - Database connection failures
   - Redis connection issues
   - Job processing failures

### Test Structure:

```typescript
// Example test structure
describe("Target Management", () => {
  beforeEach(async () => {
    // Setup test database and Redis
    await setupTestDb();
    await setupTestRedis();
  });

  afterEach(async () => {
    // Cleanup test data
    await cleanupTestDb();
    await cleanupTestRedis();
  });

  it("should add new target to database and cache", async () => {
    // Test implementation
  });

  it("should handle target removal with proper cleanup", async () => {
    // Test implementation
  });
});
```

### Test Configuration:

- **Test Database**: Separate PostgreSQL database for tests
- **Test Redis**: Separate Redis instance for tests
- **Mock Services**: Mock external APIs (Farcaster Hubs) for predictable testing
- **Test Utilities**: Shared helpers for database seeding, API mocking, and assertion helpers

### Test Scripts:

- `npm test`: Run all tests
- `npm run test:unit`: Run unit tests only
- `npm run test:integration`: Run integration tests only
- `npm run test:load`: Run load tests
- `npm run test:watch`: Run tests in watch mode during development
- `npm run test:coverage`: Generate test coverage reports

## 10. Project Structure (Monorepo)

The project will be organized as a monorepo with multiple packages for better separation of concerns and independent deployment capabilities. This will use bun workspaces.

```
.
├── docker-compose.yml
├── package.json           # Root package.json with workspace configuration
├── tsconfig.json          # Base TypeScript configuration
├── packages/
│   ├── shared/            # Shared libraries and utilities
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── types.ts         # Shared TypeScript types
│   │   │   ├── config.ts        # Configuration management
│   │   │   ├── config.test.ts   # Configuration tests
│   │   │   ├── db/
│   │   │   │   ├── index.ts     # Drizzle client instance
│   │   │   │   ├── index.test.ts # Database tests
│   │   │   │   ├── migrate.ts   # Migration utilities
│   │   │   │   ├── migrate.test.ts # Migration tests
│   │   │   │   ├── schema.ts    # Database table schemas
│   │   │   │   └── schema.test.ts # Schema tests
│   │   │   └── libs/
│   │   │       ├── hub-client.ts # Farcaster Hub client
│   │   │       └── hub-client.test.ts # Hub client tests
│   │   ├── test/
│   │   │   ├── setup.ts         # Test setup utilities
│   │   │   ├── mocks/           # Mock implementations
│   │   │   └── fixtures/        # Test data fixtures
│   │   ├── vitest.config.ts     # Vitest configuration
│   │   └── tsconfig.json
│   │
│   ├── indexer/           # Core indexing service
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts         # Main entry point (starts workers)
│   │   │   ├── index.test.ts    # Main process tests
│   │   │   ├── jobs/
│   │   │   │   ├── backfill.ts  # Backfill workers
│   │   │   │   ├── backfill.test.ts # Backfill job tests
│   │   │   │   ├── realtime.ts  # Real-time sync workers
│   │   │   │   ├── realtime.test.ts # Real-time sync tests
│   │   │   │   ├── processor.ts # Message processing worker
│   │   │   │   └── processor.test.ts # Message processing tests
│   │   │   ├── queue.ts         # BullMQ queue setup
│   │   │   ├── queue.test.ts    # Queue tests
│   │   │   └── integration/
│   │   │       └── full-flow.test.ts # End-to-end tests
│   │   ├── vitest.config.ts     # Vitest configuration
│   │   └── tsconfig.json
│   │
│   └── api/               # API server
│       ├── package.json
│       ├── src/
│       │   ├── server.ts        # Hono API server
│       │   ├── server.test.ts   # Server tests
│       │   ├── routes/
│       │   │   ├── public.ts    # Public API routes
│       │   │   ├── public.test.ts # Public API tests
│       │   │   ├── admin.ts     # Admin API routes
│       │   │   ├── admin.test.ts # Admin API tests
│       │   │   ├── auth.ts      # Authentication routes
│       │   │   └── auth.test.ts # Authentication tests
│       │   └── middleware/
│       │       ├── auth.ts      # Authentication middleware
│       │       └── auth.test.ts # Auth middleware tests
│       ├── vitest.config.ts     # Vitest configuration
│       └── tsconfig.json
│
├── apps/
│   ├── admin-web/         # Admin web interface (vite react app)
│   └── cli/               # Command-line tools
│       ├── package.json
│       ├── src/
│       │   ├── index.ts         # CLI entry point
│       │   ├── commands/
│       │   │   ├── backfill.ts  # Backfill commands
│       │   │   ├── targets.ts   # Target management
│       │   │   └── migrate.ts   # Database migrations
│       │   └── utils/
│       │       └── logger.ts    # CLI logging utilities
│       └── tsconfig.json
│
└── scripts/
    ├── dev.sh             # Development startup script
    ├── build.sh           # Build all packages
    └── deploy.sh          # Deployment script
```

### Package Dependencies:

**Packages (reusable libraries):**

- **`shared`**: Core package with no dependencies on other packages
- **`indexer`**: Depends on `shared`
- **`api`**: Depends on `shared`

**Apps (applications):**

- **`admin-web`**: Depends on `shared` (for types), communicates with `api` via HTTP
- **`cli`**: Depends on `shared`

### Workspace Configuration:

The root `package.json` will include workspace configuration:

```json
{
  "name": "farcaster-indexer",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "dev": "concurrently \"npm run dev:indexer\" \"npm run dev:api\" \"npm run dev:web\"",
    "dev:indexer": "cd packages/indexer && npm run dev",
    "dev:api": "cd packages/api && npm run dev",
    "dev:web": "cd apps/admin-web && npm run dev",
    "build": "npm run build:shared && npm run build:indexer && npm run build:api && npm run build:web",
    "build:shared": "cd packages/shared && npm run build",
    "build:indexer": "cd packages/indexer && npm run build",
    "build:api": "cd packages/api && npm run build",
    "build:web": "cd apps/admin-web && npm run build",
    "migrate": "cd apps/cli && npm run migrate",
    "test": "npm run test:shared && npm run test:indexer && npm run test:api && npm run test:cli",
    "test:shared": "cd packages/shared && npm run test",
    "test:indexer": "cd packages/indexer && npm run test",
    "test:api": "cd packages/api && npm run test",
    "test:cli": "cd apps/cli && npm run test",
    "test:watch": "npm run test:shared -- --watch",
    "test:coverage": "npm run test:shared -- --coverage && npm run test:indexer -- --coverage && npm run test:api -- --coverage",
    "test:integration": "npm run test:shared -- --run integration && npm run test:indexer -- --run integration && npm run test:api -- --run integration",
    "test:load": "npm run test:indexer -- --run load && npm run test:api -- --run load"
  }
}
```

### Benefits of Monorepo Structure:

1. **Clear Separation**: `packages/` for reusable libraries, `apps/` for applications
2. **Independent Deployment**: Components can be deployed separately
3. **Shared Code Reuse**: Common functionality in the `shared` package
4. **Better Development Experience**: Can run individual components or the entire system
5. **Scalability**: Easy to add new apps (e.g., mobile app, dashboard) or packages (additional APIs)
6. **Testing**: Each package/app can have its own test suite
7. **Modern Web Interface**: React-based admin interface with proper build tooling
8. **Consistent Tooling**: Shared TypeScript config and build processes across all packages

## 11. Local Development

A `docker-compose.yml` file will be provided to easily spin up the required services for local development.

```yaml
# docker-compose.yml
version: "3.8"
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  postgres-test:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: postgres_test
    ports:
      - "5433:5432"
    volumes:
      - postgres_test_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  redis-test:
    image: redis:7
    ports:
      - "6380:6379"
    volumes:
      - redis_test_data:/data

volumes:
  postgres_data:
  postgres_test_data:
  redis_data:
  redis_test_data:
```

To start the local environment: `docker-compose up -d`.

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Development
DATABASE_URL=postgres://postgres:password@localhost:5432/postgres
REDIS_HOST=localhost
REDIS_PORT=6379

# Testing
TEST_DATABASE_URL=postgres://postgres:password@localhost:5433/postgres_test
TEST_REDIS_HOST=localhost
TEST_REDIS_PORT=6380

# Authentication
JWT_SECRET=your-secret-key-here
ADMIN_PASSWORD=admin-password-123

# Farcaster API
NEYNAR_API_KEY=your-neynar-api-key
```
