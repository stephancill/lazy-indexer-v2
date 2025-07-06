import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config, isProduction, isDevelopment, isTest } from "../config.js";
import * as schema from "./schema.js";
import { CONNECTION_POOL_CONFIG } from "./optimizations.js";

// Get appropriate connection pool configuration based on environment
function getConnectionConfig() {
  if (isProduction()) {
    return CONNECTION_POOL_CONFIG.PRODUCTION;
  }
  if (isTest()) {
    return CONNECTION_POOL_CONFIG.TEST;
  }
  return CONNECTION_POOL_CONFIG.DEVELOPMENT;
}

// Create a connection pool for the main database with optimized settings
const poolConfig = getConnectionConfig();
const queryClient = postgres(config.postgres.connectionString, {
  ...poolConfig,
  onnotice: config.postgres?.logQueries
    ? console.log
    : () => {
        // Ignore notices when not logging queries
      },
  transform: {
    undefined: null, // Convert undefined to null for PostgreSQL compatibility
  },
  connection: {
    application_name: "farcaster-indexer",
    // Enable connection pooling optimizations
    tcp_keepalives_idle: "600",
    tcp_keepalives_interval: "30",
    tcp_keepalives_count: "3",
  },
});

// Create Drizzle database instance
export const db = drizzle(queryClient, { schema });

// Create a connection pool for testing
let testClient: postgres.Sql | null = null;
let testDb: ReturnType<typeof drizzle> | null = null;

export function getTestDb() {
  if (!testDb) {
    // Use test configuration when in test environment
    const { getTestConfig, isTest } = require("../config.js");
    const testConfig = isTest() ? getTestConfig() : config;

    testClient = postgres(testConfig.postgres.connectionString, {
      max: 5,
      idle_timeout: 10,
      max_lifetime: 60 * 10, // 10 minutes
      onnotice: () => {
        // Ignore notices in test environment
      },
    });
    testDb = drizzle(testClient, { schema });
  }
  return testDb;
}

export async function closeTestDb() {
  if (testClient) {
    await testClient.end();
    testClient = null;
    testDb = null;
  }
}

// Health check function
export async function checkDatabaseHealth() {
  try {
    const result = await queryClient`SELECT 1 as healthy`;
    return result.length === 1 && result[0].healthy === 1;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}

// Get connection pool stats
export function getPoolStats() {
  return {
    totalConnections: queryClient.options.max,
    idleConnections: queryClient.options.idle_timeout,
    maxLifetime: queryClient.options.max_lifetime,
  };
}

// Transaction helper
export async function withTransaction<T>(
  callback: (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ) => Promise<T>
): Promise<T> {
  return await db.transaction(callback);
}

// Batch insert helper with conflict handling
export async function batchInsert<T extends Record<string, any>>(
  table: any,
  data: T[],
  options: {
    batchSize?: number;
    onConflictDoNothing?: boolean;
  } = {}
) {
  const { batchSize = 1000, onConflictDoNothing = false } = options;

  const results = [];

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);

    if (onConflictDoNothing) {
      const result = await db.insert(table).values(batch).onConflictDoNothing();
      results.push(result);
    } else {
      const result = await db.insert(table).values(batch);
      results.push(result);
    }
  }

  return results;
}

// Utility function for safe database operations
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  retries = 3,
  baseDelay = 1000
): Promise<T> {
  let delay = baseDelay;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;

      console.warn(
        `Database operation failed, retrying in ${delay}ms...`,
        error
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }

  throw new Error("This should never be reached");
}

// Query building helpers
export function buildPaginationQuery(page = 1, limit = 50, maxLimit = 1000) {
  const safeLimit = Math.min(Math.max(limit, 1), maxLimit);
  const offset = (Math.max(page, 1) - 1) * safeLimit;

  return {
    limit: safeLimit,
    offset,
  };
}

export function buildDateRangeFilter(startDate?: Date, endDate?: Date) {
  const filters = [];

  if (startDate) {
    filters.push([">=", startDate]);
  }

  if (endDate) {
    filters.push(["<=", endDate]);
  }

  return filters;
}

// Graceful shutdown
export async function closeDatabaseConnections() {
  console.log("Closing database connections...");

  try {
    await queryClient.end();
    await closeTestDb();
    console.log("Database connections closed successfully");
  } catch (error) {
    console.error("Error closing database connections:", error);
    throw error;
  }
}

// Export schema and types
export { schema };
export type {
  Target,
  NewTarget,
  TargetClient,
  NewTargetClient,
  User,
  // Note: NewUser type removed since users is now a materialized view (read-only)
  Cast,
  NewCast,
  Reaction,
  NewReaction,
  Link,
  NewLink,
  Verification,
  NewVerification,
  UserData,
  NewUserData,
  UsernameProof,
  NewUsernameProof,
  OnChainEvent,
  NewOnChainEvent,
  SyncState,
  NewSyncState,
} from "./schema.js";

// Process cleanup
process.on("SIGINT", async () => {
  console.log("Received SIGINT, closing database connections...");
  await closeDatabaseConnections();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, closing database connections...");
  await closeDatabaseConnections();
  process.exit(0);
});
