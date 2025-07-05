import { Command } from "commander";
import { db, schema } from "@farcaster-indexer/shared";
import {
  scheduleBackfillJob,
  getAllQueueStats,
  clearQueue,
} from "@farcaster-indexer/indexer";
import { eq, count, isNull, and } from "drizzle-orm";
import { logger } from "../utils/logger.js";

const { targets } = schema;

export const backfillCommand = new Command("backfill")
  .description("Backfill management commands")
  .addCommand(
    new Command("start")
      .description("Start backfill for unsynced targets")
      .option("--fid <fid>", "Backfill specific FID")
      .option("--root-only", "Only backfill root targets")
      .option("--limit <number>", "Limit number of targets to backfill", "0")
      .action(async (options) => {
        try {
          logger.startSpinner("Preparing backfill jobs...");

          let targetsToBackfill;

          if (options.fid) {
            const fidNum = Number.parseInt(options.fid);
            if (isNaN(fidNum) || fidNum <= 0) {
              logger.error("FID must be a positive number");
              process.exit(1);
            }

            targetsToBackfill = await db
              .select({ fid: targets.fid, isRoot: targets.isRoot })
              .from(targets)
              .where(eq(targets.fid, fidNum));

            if (targetsToBackfill.length === 0) {
              logger.stopSpinner(false, `Target ${fidNum} not found`);
              process.exit(1);
            }
          } else {
            const whereConditions = [isNull(targets.lastSyncedAt)];

            if (options.rootOnly) {
              whereConditions.push(eq(targets.isRoot, true));
            }

            const whereClause =
              whereConditions.length > 1
                ? and(...whereConditions)
                : whereConditions[0];

            let query = db
              .select({ fid: targets.fid, isRoot: targets.isRoot })
              .from(targets)
              .where(whereClause)
              .$dynamic();

            if (options.limit && Number.parseInt(options.limit) > 0) {
              query = query.limit(Number.parseInt(options.limit));
            }

            targetsToBackfill = await query;
          }

          logger.updateSpinner(
            `Queuing ${targetsToBackfill.length} backfill jobs...`
          );

          for (const target of targetsToBackfill) {
            await scheduleBackfillJob(target.fid, target.isRoot);
          }

          logger.stopSpinner(
            true,
            `Queued ${targetsToBackfill.length} backfill jobs successfully`
          );

          if (targetsToBackfill.length > 0) {
            logger.info(
              `Jobs queued for FIDs: ${targetsToBackfill
                .map((t) => t.fid)
                .join(", ")}`
            );
          }
        } catch (error) {
          logger.stopSpinner(false, "Failed to queue backfill jobs");
          logger.error(
            `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("status")
      .description("Check backfill status")
      .action(async () => {
        try {
          logger.startSpinner("Checking backfill status...");

          const [unsyncedCount] = await db
            .select({ count: count() })
            .from(targets)
            .where(isNull(targets.lastSyncedAt));

          const queueStats = await getAllQueueStats();
          const backfillStats = queueStats.find(
            (q) => q.queue === "backfill"
          ) || {
            queue: "backfill",
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            paused: 0,
          };

          logger.stopSpinner(true, "Backfill status retrieved");

          const status = {
            "Unsynced Targets": unsyncedCount.count,
            "Jobs Waiting": backfillStats.waiting,
            "Jobs Active": backfillStats.active,
            "Jobs Completed": backfillStats.completed,
            "Jobs Failed": backfillStats.failed,
          };

          logger.table([status]);

          if (backfillStats.failed > 0) {
            logger.warn(
              `${backfillStats.failed} failed jobs. Use 'jobs failed' to see details.`
            );
          }
        } catch (error) {
          logger.stopSpinner(false, "Failed to check backfill status");
          logger.error(
            `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("retry")
      .description("Retry failed backfill jobs")
      .option("--all", "Retry all failed jobs")
      .option("--fid <fid>", "Retry specific FID")
      .action(async (options) => {
        try {
          logger.startSpinner("Retrying failed backfill jobs...");

          if (options.fid) {
            const fidNum = Number.parseInt(options.fid);
            if (isNaN(fidNum) || fidNum <= 0) {
              logger.error("FID must be a positive number");
              process.exit(1);
            }

            // For specific FID, just reschedule the job
            await scheduleBackfillJob(fidNum, false);
            logger.stopSpinner(true, `Retried backfill job for FID ${fidNum}`);
          } else if (options.all) {
            // Clear failed jobs which will allow them to be retried
            await clearQueue("backfill");
            logger.stopSpinner(
              true,
              "Cleared failed jobs - they can now be rescheduled"
            );
          } else {
            logger.error(
              "Specify --all to retry all failed jobs or --fid <fid> to retry specific FID"
            );
            process.exit(1);
          }
        } catch (error) {
          logger.stopSpinner(false, "Failed to retry jobs");
          logger.error(
            `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("clear")
      .description("Clear completed backfill jobs")
      .option("--confirm", "Confirm clearing jobs")
      .action(async (options) => {
        if (!options.confirm) {
          logger.error(
            "This operation will clear completed jobs. Use --confirm to proceed."
          );
          process.exit(1);
        }

        try {
          logger.startSpinner("Clearing completed backfill jobs...");

          await clearQueue("backfill");

          logger.stopSpinner(
            true,
            "Completed backfill jobs cleared successfully"
          );
        } catch (error) {
          logger.stopSpinner(false, "Failed to clear completed jobs");
          logger.error(
            `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          process.exit(1);
        }
      })
  );
