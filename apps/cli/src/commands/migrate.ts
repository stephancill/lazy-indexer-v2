import { Command } from "commander";
import {
  db,
  runMigrations,
  resetDatabase,
  closeDatabaseConnections,
} from "@farcaster-indexer/shared";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger.js";

export const migrateCommand = new Command("migrate")
  .description("Database migration commands")
  .addCommand(
    new Command("up").description("Run pending migrations").action(async () => {
      try {
        logger.startSpinner("Running database migrations...");

        await runMigrations();

        logger.stopSpinner(true, "Database migrations completed successfully");

        // Close database connections to allow process to exit
        await closeDatabaseConnections();

        process.exit(0);
      } catch (error) {
        logger.stopSpinner(false, "Migration failed");
        logger.error(
          `Migration error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );

        // Close connections even on error
        try {
          await closeDatabaseConnections();
        } catch (cleanupError) {
          console.error("Error during cleanup:", cleanupError);
        }

        process.exit(1);
      }
    })
  )
  .addCommand(
    new Command("reset")
      .description("Reset database (drop all tables and re-run migrations)")
      .option("--confirm", "Confirm destructive operation")
      .action(async (options) => {
        if (!options.confirm) {
          logger.error(
            "This operation will destroy all data. Use --confirm to proceed."
          );
          process.exit(1);
        }

        try {
          logger.startSpinner("Resetting database...");

          await resetDatabase();

          logger.stopSpinner(true, "Database reset completed successfully");

          // Close database connections to allow process to exit
          await closeDatabaseConnections();

          process.exit(0);
        } catch (error) {
          logger.stopSpinner(false, "Database reset failed");
          logger.error(
            `Reset error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );

          // Close connections even on error
          try {
            await closeDatabaseConnections();
          } catch (cleanupError) {
            console.error("Error during cleanup:", cleanupError);
          }

          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("status")
      .description("Check database connection and migration status")
      .action(async () => {
        try {
          logger.startSpinner("Checking database status...");

          // Test connection
          const result = await db.execute(sql`SELECT 1 as test`);
          logger.debug("Database connection test result:", "DB");

          // Try to check if migrations table exists
          try {
            await db.execute(sql`SELECT COUNT(*) FROM __drizzle_migrations`);
            logger.stopSpinner(
              true,
              "Database is connected and migrations table exists"
            );
          } catch (error) {
            logger.stopSpinner(
              true,
              "Database is connected but migrations table not found"
            );
            logger.warn('Run "migrate up" to initialize the database');
          }

          // Close database connections to allow process to exit
          await closeDatabaseConnections();

          process.exit(0);
        } catch (error) {
          logger.stopSpinner(false, "Database connection failed");
          logger.error(
            `Connection error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );

          // Close connections even on error
          try {
            await closeDatabaseConnections();
          } catch (cleanupError) {
            console.error("Error during cleanup:", cleanupError);
          }

          process.exit(1);
        }
      })
  );
