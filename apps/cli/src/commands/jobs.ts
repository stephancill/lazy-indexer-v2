import { Command } from "commander";
import {
  getAllQueueStats,
  getQueueStats,
  pauseQueue,
  resumeQueue,
  clearQueue,
} from "@farcaster-indexer/indexer";
import { logger } from "../utils/logger.js";

export const jobCommands = new Command("jobs")
  .description("Job queue monitoring and management commands")
  .addCommand(
    new Command("status")
      .description("Show job queue status")
      .option(
        "--queue <queue>",
        "Show specific queue (backfill, realtime)",
        "all"
      )
      .option("--json", "Output as JSON")
      .action(async (options) => {
        try {
          logger.startSpinner("Fetching job queue status...");

          let queueStats: Array<{
            queue: string;
            waiting: number;
            active: number;
            completed: number;
            failed: number;
            delayed: number;
            paused: number;
          }> = [];

          if (options.queue === "all") {
            queueStats = await getAllQueueStats();
          } else {
            const stat = await getQueueStats(options.queue);
            if (stat) {
              queueStats = [stat];
            }
          }

          logger.stopSpinner(true, "Job queue status retrieved");

          if (options.json) {
            logger.json(queueStats);
          } else {
            logger.table(
              queueStats.map((stat) => ({
                Queue: stat.queue,
                Waiting: stat.waiting,
                Active: stat.active,
                Completed: stat.completed,
                Failed: stat.failed,
                Delayed: stat.delayed,
              }))
            );
          }
        } catch (error) {
          logger.stopSpinner(false, "Failed to fetch job queue status");
          logger.error(
            `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("summary")
      .description("Show detailed job queue summary")
      .option(
        "--queue <queue>",
        "Show specific queue (backfill, realtime)",
        "all"
      )
      .option("--json", "Output as JSON")
      .action(async (options) => {
        try {
          logger.startSpinner("Fetching job queue summary...");

          let queueStats: Array<{
            queue: string;
            waiting: number;
            active: number;
            completed: number;
            failed: number;
            delayed: number;
            paused: number;
          }> = [];

          if (options.queue === "all") {
            queueStats = await getAllQueueStats();
          } else {
            const stat = await getQueueStats(options.queue);
            if (stat) {
              queueStats = [stat];
            }
          }

          logger.stopSpinner(true, "Job queue summary retrieved");

          if (options.json) {
            logger.json(queueStats);
          } else {
            queueStats.forEach((stat) => {
              logger.info(`Queue: ${stat.queue}`);
              logger.info(`  Waiting: ${stat.waiting}`);
              logger.info(`  Active: ${stat.active}`);
              logger.info(`  Completed: ${stat.completed}`);
              logger.info(`  Failed: ${stat.failed}`);
              logger.info(`  Delayed: ${stat.delayed}`);
              logger.info(`  Paused: ${stat.paused ? "Yes" : "No"}`);
              logger.line();
            });

            const totals = queueStats.reduce(
              (acc, stat) => ({
                waiting: acc.waiting + stat.waiting,
                active: acc.active + stat.active,
                completed: acc.completed + stat.completed,
                failed: acc.failed + stat.failed,
                delayed: acc.delayed + stat.delayed,
              }),
              { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
            );

            logger.info("Total across all queues:");
            logger.table([totals]);
          }
        } catch (error) {
          logger.stopSpinner(false, "Failed to fetch job queue summary");
          logger.error(
            `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("pause")
      .description("Pause a job queue")
      .argument("<queue>", "Queue to pause (backfill, realtime)")
      .action(async (queue) => {
        try {
          logger.startSpinner(`Pausing ${queue} queue...`);

          await pauseQueue(queue);

          logger.stopSpinner(true, `${queue} queue paused successfully`);
        } catch (error) {
          logger.stopSpinner(false, `Failed to pause ${queue} queue`);
          logger.error(
            `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("resume")
      .description("Resume a job queue")
      .argument("<queue>", "Queue to resume (backfill, realtime)")
      .action(async (queue) => {
        try {
          logger.startSpinner(`Resuming ${queue} queue...`);

          await resumeQueue(queue);

          logger.stopSpinner(true, `${queue} queue resumed successfully`);
        } catch (error) {
          logger.stopSpinner(false, `Failed to resume ${queue} queue`);
          logger.error(
            `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command("clear")
      .description("Clear completed jobs from a queue")
      .argument("<queue>", "Queue to clear (backfill, realtime)")
      .option("--confirm", "Confirm clearing jobs")
      .action(async (queue, options) => {
        if (!options.confirm) {
          logger.error(
            "This operation will clear completed jobs. Use --confirm to proceed."
          );
          process.exit(1);
        }

        try {
          logger.startSpinner(`Clearing jobs from ${queue} queue...`);

          await clearQueue(queue);

          logger.stopSpinner(
            true,
            `Jobs cleared from ${queue} queue successfully`
          );
        } catch (error) {
          logger.stopSpinner(
            false,
            `Failed to clear completed jobs from ${queue} queue`
          );
          logger.error(
            `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          process.exit(1);
        }
      })
  );
