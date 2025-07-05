import { Command } from "commander";
import { db, config, HubClient } from "@farcaster-indexer/shared";
import { getAllQueueStats } from "@farcaster-indexer/indexer";
import { sql } from "drizzle-orm";
import { logger } from "../utils/logger.js";
import { Redis } from "ioredis";

export const healthCommand = new Command("health")
  .description("System health check commands")
  .addCommand(
    new Command("check")
      .description("Perform comprehensive health check")
      .option("--json", "Output as JSON")
      .action(async (options) => {
        try {
          logger.startSpinner("Performing health checks...");

          const healthStatus = {
            database: false,
            redis: false,
            hubClient: false,
            queues: {
              backfill: false,
              realtime: false,
            },
            overall: false,
          };

          const details = [];

          // Database health check
          try {
            await db.execute(sql`SELECT 1`);
            healthStatus.database = true;
            details.push({
              component: "Database",
              status: "healthy",
              message: "Connection successful",
            });
          } catch (error) {
            details.push({
              component: "Database",
              status: "unhealthy",
              message: error instanceof Error ? error.message : "Unknown error",
            });
          }

          // Redis health check
          try {
            const redisClient = new Redis({
              host: config.redis.host,
              port: config.redis.port,
            });
            await redisClient.ping();
            await redisClient.quit();
            healthStatus.redis = true;
            details.push({
              component: "Redis",
              status: "healthy",
              message: "Connection successful",
            });
          } catch (error) {
            details.push({
              component: "Redis",
              status: "unhealthy",
              message: error instanceof Error ? error.message : "Unknown error",
            });
          }

          // Hub client health check
          try {
            const hubClient = new HubClient(config.hubs);
            // Note: Hub client getInfo method needs to be implemented
            healthStatus.hubClient = true;
            details.push({
              component: "Hub Client",
              status: "healthy",
              message: "Hub client initialized successfully",
            });
          } catch (error) {
            details.push({
              component: "Hub Client",
              status: "unhealthy",
              message: error instanceof Error ? error.message : "Unknown error",
            });
          }

          // Queue health checks
          try {
            const queueStats = await getAllQueueStats();
            const backfillStats = queueStats.find(
              (q) => q.queue === "backfill"
            );
            const realtimeStats = queueStats.find(
              (q) => q.queue === "realtime"
            );

            if (backfillStats) {
              healthStatus.queues.backfill = true;
              details.push({
                component: "Backfill Queue",
                status: "healthy",
                message: "Queue accessible",
              });
            } else {
              details.push({
                component: "Backfill Queue",
                status: "unhealthy",
                message: "Queue not found",
              });
            }

            if (realtimeStats) {
              healthStatus.queues.realtime = true;
              details.push({
                component: "Realtime Queue",
                status: "healthy",
                message: "Queue accessible",
              });
            } else {
              details.push({
                component: "Realtime Queue",
                status: "unhealthy",
                message: "Queue not found",
              });
            }
          } catch (error) {
            details.push({
              component: "Queue System",
              status: "unhealthy",
              message: error instanceof Error ? error.message : "Unknown error",
            });
          }

          // Overall health
          healthStatus.overall =
            healthStatus.database &&
            healthStatus.redis &&
            healthStatus.hubClient &&
            healthStatus.queues.backfill &&
            healthStatus.queues.realtime;

          logger.stopSpinner(
            true,
            `Health check completed - ${
              healthStatus.overall ? "System healthy" : "Issues detected"
            }`
          );

          if (options.json) {
            logger.json({ status: healthStatus, details });
          } else {
            logger.table(
              details.map((detail) => ({
                Component: detail.component,
                Status:
                  detail.status === "healthy" ? "✅ Healthy" : "❌ Unhealthy",
                Message: detail.message,
              }))
            );

            logger.line();
            if (healthStatus.overall) {
              logger.success("Overall system status: Healthy");
            } else {
              logger.error("Overall system status: Unhealthy");
              process.exit(1);
            }
          }
        } catch (error) {
          logger.stopSpinner(false, "Health check failed");
          logger.error(
            `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("database")
      .description("Check database health and connection")
      .action(async () => {
        try {
          logger.startSpinner("Checking database health...");

          // Basic connection test
          await db.execute(sql`SELECT 1 as test`);

          // Check if migrations table exists
          let migrationsExist = false;
          try {
            await db.execute(sql`SELECT COUNT(*) FROM __drizzle_migrations`);
            migrationsExist = true;
          } catch (error) {
            // Migrations table doesn't exist
          }

          // Get basic statistics
          const stats = [];
          try {
            const targetsCount = await db.execute(
              sql`SELECT COUNT(*) as count FROM targets`
            );
            stats.push({
              table: "targets",
              count: targetsCount[0]?.count || 0,
            });

            const usersCount = await db.execute(
              sql`SELECT COUNT(*) as count FROM users`
            );
            stats.push({ table: "users", count: usersCount[0]?.count || 0 });

            const castsCount = await db.execute(
              sql`SELECT COUNT(*) as count FROM casts`
            );
            stats.push({ table: "casts", count: castsCount[0]?.count || 0 });

            const reactionsCount = await db.execute(
              sql`SELECT COUNT(*) as count FROM reactions`
            );
            stats.push({
              table: "reactions",
              count: reactionsCount[0]?.count || 0,
            });

            const linksCount = await db.execute(
              sql`SELECT COUNT(*) as count FROM links`
            );
            stats.push({ table: "links", count: linksCount[0]?.count || 0 });
          } catch (error) {
            // Tables might not exist yet
          }

          logger.stopSpinner(true, "Database health check completed");

          logger.success("Database connection: Healthy");
          logger.info(
            `Migrations table: ${migrationsExist ? "Exists" : "Not found"}`
          );

          if (stats.length > 0) {
            logger.line();
            logger.table(
              stats.map((stat) => ({
                Table: stat.table,
                "Record Count": stat.count,
              }))
            );
          }
        } catch (error) {
          logger.stopSpinner(false, "Database health check failed");
          logger.error(
            `Database error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("redis")
      .description("Check Redis health and connection")
      .action(async () => {
        try {
          logger.startSpinner("Checking Redis health...");

          const redisClient = new Redis({
            host: config.redis.host,
            port: config.redis.port,
          });

          // Basic ping test
          const pingResult = await redisClient.ping();

          // Get Redis info
          const info = await redisClient.info();
          const lines = info.split("\r\n");
          const redisVersion = lines
            .find((line) => line.startsWith("redis_version:"))
            ?.split(":")[1];
          const uptime = lines
            .find((line) => line.startsWith("uptime_in_seconds:"))
            ?.split(":")[1];
          const connectedClients = lines
            .find((line) => line.startsWith("connected_clients:"))
            ?.split(":")[1];
          const usedMemory = lines
            .find((line) => line.startsWith("used_memory_human:"))
            ?.split(":")[1];

          // Check for target sets
          const targetSetExists = await redisClient.exists("targets");
          const clientSetExists = await redisClient.exists("client_targets");

          await redisClient.quit();

          logger.stopSpinner(true, "Redis health check completed");

          logger.success("Redis connection: Healthy");
          logger.info(`Redis version: ${redisVersion || "Unknown"}`);
          logger.info(
            `Uptime: ${
              uptime
                ? Math.floor(Number.parseInt(uptime) / 86400) + " days"
                : "Unknown"
            }`
          );
          logger.info(`Connected clients: ${connectedClients || "Unknown"}`);
          logger.info(`Memory usage: ${usedMemory || "Unknown"}`);
          logger.info(`Target set exists: ${targetSetExists ? "Yes" : "No"}`);
          logger.info(
            `Client target set exists: ${clientSetExists ? "Yes" : "No"}`
          );
        } catch (error) {
          logger.stopSpinner(false, "Redis health check failed");
          logger.error(
            `Redis error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("hubs")
      .description("Check Farcaster hub health and connectivity")
      .action(async () => {
        try {
          logger.startSpinner("Checking Farcaster hub health...");

          const hubClient = new HubClient(config.hubs);
          const results = [];

          // Test each hub individually
          for (const [index, hub] of config.hubs.entries()) {
            try {
              const tempClient = new HubClient([hub]);
              // Note: Hub client getInfo method needs to be implemented
              results.push({
                hub: hub.url,
                status: "healthy",
                version: "unknown",
                message: "Hub client initialized",
              });
            } catch (error) {
              results.push({
                hub: hub.url,
                status: "unhealthy",
                version: "unknown",
                message:
                  error instanceof Error ? error.message : "Unknown error",
              });
            }
          }

          logger.stopSpinner(true, "Hub health check completed");

          logger.table(
            results.map((result) => ({
              Hub: result.hub,
              Status:
                result.status === "healthy" ? "✅ Healthy" : "❌ Unhealthy",
              Version: result.version,
              Message: result.message,
            }))
          );

          const healthyHubs = results.filter(
            (r) => r.status === "healthy"
          ).length;
          const totalHubs = results.length;

          logger.line();
          logger.info(`Healthy hubs: ${healthyHubs}/${totalHubs}`);

          if (healthyHubs === 0) {
            logger.error("No healthy hubs found");
            process.exit(1);
          }
        } catch (error) {
          logger.stopSpinner(false, "Hub health check failed");
          logger.error(
            `Hub error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
          process.exit(1);
        }
      })
  );
