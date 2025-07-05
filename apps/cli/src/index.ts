#!/usr/bin/env node

import { Command } from "commander";
import { config } from "@farcaster-indexer/shared";
import chalk from "chalk";
import { migrateCommand } from "./commands/migrate.js";
import { targetCommands } from "./commands/targets.js";
import { backfillCommand } from "./commands/backfill.js";
import { jobCommands } from "./commands/jobs.js";
import { healthCommand } from "./commands/health.js";
import { debugCommand } from "./commands/debug.js";
import { exportCommand, importCommand } from "./commands/data.js";

const program = new Command();

program
  .name("farcaster-indexer")
  .description(
    "Farcaster Indexer CLI - Database migrations, target management, and system operations"
  )
  .version("1.0.0");

program.hook("preAction", () => {
  console.log(chalk.blue("🚀 Farcaster Indexer CLI"));
  console.log(
    chalk.gray(
      `Database: ${config.postgres.connectionString.replace(
        /\/\/.*@/,
        "//***@"
      )}`
    )
  );
  console.log(chalk.gray(`Redis: ${config.redis.host}:${config.redis.port}`));
  console.log("");
});

// Database migration commands
program.addCommand(migrateCommand);

// Target management commands
program.addCommand(targetCommands);

// Backfill commands
program.addCommand(backfillCommand);

// Job monitoring commands
program.addCommand(jobCommands);

// Health check commands
program.addCommand(healthCommand);

// Debug commands
program.addCommand(debugCommand);

// Data export/import commands
program.addCommand(exportCommand);
program.addCommand(importCommand);

// Global error handling
program.exitOverride((err) => {
  console.error(chalk.red("❌ Error:"), err.message);
  process.exit(1);
});

// Parse command line arguments
program.parse();

export default program;
