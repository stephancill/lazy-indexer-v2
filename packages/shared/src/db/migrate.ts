import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { config } from "../config.js";

export async function runMigrations() {
  console.log("Starting database migrations...");

  const { execSync } = await import("node:child_process");
  const path = await import("node:path");

  try {
    // Find the project root by looking for package.json
    let currentDir = process.cwd();
    let projectRoot = currentDir;

    // Walk up the directory tree to find project root (where package.json exists)
    while (currentDir !== path.dirname(currentDir)) {
      const fs = await import("node:fs");
      if (
        fs.existsSync(path.join(currentDir, "package.json")) &&
        fs.existsSync(path.join(currentDir, "drizzle"))
      ) {
        projectRoot = currentDir;
        break;
      }
      currentDir = path.dirname(currentDir);
    }

    console.log(`Running migrations from project root: ${projectRoot}`);

    // Use drizzle-kit up:pg command to run migrations
    const migrateCommand = "npx drizzle-kit up:pg";
    console.log(`Executing: ${migrateCommand}`);

    execSync(migrateCommand, {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: config.postgres.connectionString,
      },
    });

    console.log("Database migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

export async function createMigration(name: string) {
  const { execSync } = await import("node:child_process");

  try {
    console.log(`Creating migration: ${name}`);

    // Generate migration using drizzle-kit
    execSync(
      "npx drizzle-kit generate:pg --out drizzle --schema packages/shared/src/db/schema.ts",
      {
        stdio: "inherit",
      }
    );

    console.log("Migration created successfully!");
  } catch (error) {
    console.error("Failed to create migration:", error);
    throw error;
  }
}

export async function resetDatabase() {
  const client = postgres(config.postgres.connectionString, {
    max: 1,
  });

  try {
    console.log("Resetting database...");

    // Drop all tables (be careful!)
    const tables = [
      "sync_state",
      "on_chain_events",
      "username_proofs",
      "user_data",
      "verifications",
      "links",
      "reactions",
      "casts",
      "users",
      "target_clients",
      "targets",
      "__drizzle_migrations",
    ];

    for (const table of tables) {
      await client`DROP TABLE IF EXISTS ${client(table)} CASCADE`;
    }

    console.log("Database reset completed!");
  } catch (error) {
    console.error("Database reset failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

export async function seedDatabase() {
  const client = postgres(config.postgres.connectionString, {
    max: 1,
  });

  const db = drizzle(client);

  try {
    console.log("Seeding database...");

    // Add some initial targets from config
    const { targets, targetClients } = await import("./schema.js");

    // Insert root targets
    if (config.strategy.rootTargets.length > 0) {
      await db
        .insert(targets)
        .values(
          config.strategy.rootTargets.map((fid) => ({
            fid,
            isRoot: true,
            addedAt: new Date(),
          }))
        )
        .onConflictDoNothing();
    }

    // Insert target clients
    if (config.strategy.targetClients.length > 0) {
      await db
        .insert(targetClients)
        .values(
          config.strategy.targetClients.map((clientFid) => ({
            clientFid,
            addedAt: new Date(),
          }))
        )
        .onConflictDoNothing();
    }

    console.log("Database seeding completed!");
  } catch (error) {
    console.error("Database seeding failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

export async function checkDatabaseConnection() {
  const client = postgres(config.postgres.connectionString, {
    max: 1,
  });

  try {
    console.log("Checking database connection...");

    // Simple query to test connection
    const result = await client`SELECT 1 as test`;

    if (result.length === 1 && result[0].test === 1) {
      console.log("Database connection successful!");
      return true;
    }
      console.error("Database connection test failed: unexpected result");
      return false;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  } finally {
    await client.end();
  }
}

export async function getTableStats() {
  const client = postgres(config.postgres.connectionString, {
    max: 1,
  });

  try {
    console.log("Gathering table statistics...");

    const stats = await client`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_rows,
        n_dead_tup as dead_rows,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC;
    `;

    console.table(stats);
    return stats;
  } catch (error) {
    console.error("Failed to get table stats:", error);
    throw error;
  } finally {
    await client.end();
  }
}
