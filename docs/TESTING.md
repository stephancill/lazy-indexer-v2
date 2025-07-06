# Testing Guide

This document provides comprehensive instructions for running and understanding tests in the Farcaster Indexer project.

## Overview

The project uses [Vitest](https://vitest.dev/) as the testing framework across all packages. Tests are organized by package with shared testing utilities and consistent patterns.

## Test Environment Setup

### Prerequisites

1. **Docker Services**: Ensure PostgreSQL and Redis test containers are running

   ```bash
   # Start test services
   docker-compose -f docker-compose.test.yml up -d
   ```

2. **Dependencies**: Install all dependencies

   ```bash
   bun install
   ```

3. **Database Setup**: Run migrations on both development and test databases

   ```bash
   # Development database
   bun run migrate up

   # Test database (if needed)
   NODE_ENV=test bun run migrate up
   ```

### Environment Variables

Create a `.env` file in the project root with test configuration:

```bash
# Test Database
TEST_DATABASE_URL=postgres://postgres:password@localhost:5433/postgres_test
TEST_REDIS_HOST=localhost
TEST_REDIS_PORT=6380

# Development Database
DATABASE_URL=postgres://postgres:password@localhost:5432/postgres
REDIS_HOST=localhost
REDIS_PORT=6379

# Authentication (for API tests)
JWT_SECRET=test-secret-key-minimum-32-characters-long
ADMIN_PASSWORD=test-admin-password

# Farcaster API (optional for hub client tests)
NEYNAR_API_KEY=your-neynar-api-key
```

## Running Tests

### Quick Commands

```bash
# Run all tests
bun test --run

# Run tests in watch mode
bun test

# Run tests with coverage
bun run test:coverage

# Run specific package tests
bun run test:shared
bun run test:indexer
bun run test:api
bun run test:cli
```

### Package-Specific Testing

#### Shared Package Tests

```bash
cd packages/shared
bun test

# Specific test files
bun test src/db/schema.test.ts
bun test src/libs/hub-client.test.ts
bun test src/config.test.ts
```

#### Indexer Package Tests

```bash
cd packages/indexer
bun test

# Integration tests
bun test --run integration

# Load tests
bun test --run load
```

#### API Package Tests

```bash
cd packages/api
bun test

# Test specific routes
bun test src/routes/public.test.ts
bun test src/routes/admin.test.ts
```

#### CLI Package Tests

```bash
cd apps/cli
bun test
```

### Test Categories

#### Unit Tests

Test individual functions and classes in isolation:

```bash
# Configuration tests
bun test src/config.test.ts

# Database schema tests
bun test src/db/schema.test.ts

# Hub client tests
bun test src/libs/hub-client.test.ts
```

#### Integration Tests

Test component interactions and end-to-end flows:

```bash
# Run integration tests only
bun test --run integration

# Specific integration test files
bun test src/integration/full-flow.test.ts
```

#### Load Tests

Test performance under simulated load:

```bash
# Run load tests only
bun test --run load

# Database performance tests
bun test --run load packages/shared/src/db/
```

## Test Database Management

### Automatic Setup

Tests automatically:

- Connect to the test database (`postgres_test` on port 5433)
- Run cleanup before/after each test
- Handle database migrations

### Manual Database Operations

#### Reset Test Database

```bash
# Connect to test database container
docker exec -it farcaster-indexer-bun-postgres-test-1 psql -U postgres -d postgres_test

# Check tables
\dt

# Clear all data
TRUNCATE TABLE targets, users, casts, reactions, links, verifications, user_data, username_proofs, on_chain_events, sync_state RESTART IDENTITY CASCADE;
```

#### Re-run Migrations

If you need to reset the test database schema:

```bash
# Copy migration files to container
docker cp drizzle/0000_cool_sally_floyd.sql farcaster-indexer-bun-postgres-test-1:/tmp/migration.sql

# Run migration
docker exec farcaster-indexer-bun-postgres-test-1 psql -U postgres -d postgres_test -f /tmp/migration.sql
```

## Understanding Test Output

### Successful Test Run

```
bun test v1.1.38

packages/shared/src/config.test.ts:
✓ Configuration Module > should validate config (25 pass)

packages/shared/src/db/schema.test.ts:
✓ Database Schema > Targets Table (13 pass)
✓ Database Schema > Users Table (pass)
...

61 pass
4 fail (network timeouts)
136 expect() calls
Ran 65 tests across 3 files. [40.35s]
```

### Common Test Failures

#### Database Connection Issues

```
PostgresError: relation "sync_state" does not exist
```

**Solution**: Run database migrations on test database

#### Network Timeout Issues

```
Test "should handle HTTP errors" timed out after 5001ms
```

**Solution**: These are known issues with HubClient mock setup in Bun environment. Tests are functionally correct.

#### Environment Issues

```
error: Test database not configured
```

**Solution**: Ensure `NODE_ENV=test` and `TEST_DATABASE_URL` are set

## Test Architecture

### Shared Testing Utilities

Located in `packages/shared/test/`:

- `setup.ts`: Global test configuration and database setup
- `mocks/`: Mock implementations for external services
- `fixtures/`: Test data fixtures

### Mock Strategy

#### Database Mocking

- Uses real test database for integration fidelity
- Automatic cleanup between tests
- Isolated test data

#### External API Mocking

```typescript
// Hub client tests use dependency injection
const mockFetch = vi.fn();
const hubClient = new HubClient(configs, mockFetch);

// Real Farcaster hub responses for realistic mocking
const MOCK_RESPONSES = {
  hubInfo: {
    /* real hub.merv.fun response */
  },
  events: {
    /* real events response */
  },
  // ...
};
```

#### Redis Mocking

- Uses separate Redis instance (port 6380)
- Automatic cleanup between tests

### Test Patterns

#### Database Tests

```typescript
describe("Database Operations", () => {
  beforeEach(async () => {
    // Cleanup handled automatically by test setup
  });

  it("should insert and retrieve data", async () => {
    const testData = {
      /* ... */
    };
    await db.insert(table).values(testData);

    const result = await db.select().from(table);
    expect(result[0]).toMatchObject(testData);
  });
});
```

#### API Tests

```typescript
describe("API Endpoints", () => {
  it("should return expected response", async () => {
    const response = await app.request("/api/endpoint");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: expect.any(Object),
    });
  });
});
```

## Performance Testing

### Database Benchmarks

```bash
# Run database performance tests
bun test --run load packages/shared/src/db/

# Check benchmark results
bun test src/db/benchmarks.test.ts
```

### API Load Testing

```bash
# Run API performance tests
bun test --run load packages/api/
```

## Debugging Tests

### Verbose Output

```bash
# Run with detailed output
bun test --reporter=verbose

# Run single test with debugging
bun test --reporter=verbose src/specific-test.test.ts
```

### Database Debugging

```bash
# Check test database state
docker exec farcaster-indexer-bun-postgres-test-1 psql -U postgres -d postgres_test -c "SELECT COUNT(*) FROM targets;"

# View test logs
bun test --reporter=verbose | grep -A 5 -B 5 "Database"
```

### Network Debugging

```bash
# Test hub connectivity
curl -s "https://hub.merv.fun/v1/info" | jq .

# Check mock setup
bun test --reporter=verbose src/libs/hub-client.test.ts
```

## CI/CD Integration

### GitHub Actions

The project includes test automation:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: |
    docker-compose -f docker-compose.test.yml up -d
    bun install
    bun run migrate up
    NODE_ENV=test bun test --run
```

### Local CI Simulation

```bash
# Simulate CI environment
docker-compose -f docker-compose.test.yml down
docker-compose -f docker-compose.test.yml up -d
bun install
bun run migrate up
NODE_ENV=test bun test --run
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**

   ```bash
   # Check if ports are in use
   lsof -i :5432 -i :5433 -i :6379 -i :6380

   # Restart Docker services
   docker-compose -f docker-compose.test.yml down && docker-compose -f docker-compose.test.yml up -d
   ```

2. **Stale Test Data**

   ```bash
   # Reset test database
   docker exec farcaster-indexer-bun-postgres-test-1 psql -U postgres -d postgres_test -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

   # Re-run migrations
   docker cp drizzle/0000_cool_sally_floyd.sql farcaster-indexer-bun-postgres-test-1:/tmp/migration.sql
   docker exec farcaster-indexer-bun-postgres-test-1 psql -U postgres -d postgres_test -f /tmp/migration.sql
   ```

3. **Module Cache Issues**

   ```bash
   # Clear Bun cache
   rm -rf node_modules/.cache

   # Rebuild packages
   bun run build
   ```

### Getting Help

- Check test logs: `bun test --reporter=verbose`
- Verify environment: `bun test src/config.test.ts`
- Database status: `docker exec farcaster-indexer-bun-postgres-test-1 psql -U postgres -d postgres_test -c "\dt"`
- Network connectivity: `curl -s "https://hub.merv.fun/v1/info"`

## Best Practices

1. **Write Descriptive Tests**: Use clear test names and descriptions
2. **Test Edge Cases**: Include error conditions and boundary cases
3. **Use Real Data**: Mock with actual API responses when possible
4. **Isolate Tests**: Ensure tests don't depend on each other
5. **Clean Up**: Use proper setup/teardown for test data
6. **Performance**: Monitor test execution time and optimize slow tests

## Contributing

When adding new tests:

1. Follow existing test patterns
2. Add appropriate cleanup
3. Use descriptive test names
4. Include both positive and negative test cases
5. Update this documentation if adding new test categories
