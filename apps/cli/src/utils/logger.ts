import chalk from "chalk";
import ora, { Ora } from "ora";

export class Logger {
  private static instance: Logger;
  private spinner: Ora | null = null;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  info(message: string, prefix?: string): void {
    const prefixStr = prefix ? `[${prefix}] ` : "";
    console.log(chalk.blue("ℹ "), prefixStr + message);
  }

  success(message: string, prefix?: string): void {
    const prefixStr = prefix ? `[${prefix}] ` : "";
    console.log(chalk.green("✅"), prefixStr + message);
  }

  error(message: string, prefix?: string): void {
    const prefixStr = prefix ? `[${prefix}] ` : "";
    console.error(chalk.red("❌"), prefixStr + message);
  }

  warn(message: string, prefix?: string): void {
    const prefixStr = prefix ? `[${prefix}] ` : "";
    console.warn(chalk.yellow("⚠️ "), prefixStr + message);
  }

  debug(message: string, prefix?: string): void {
    if (process.env.DEBUG) {
      const prefixStr = prefix ? `[${prefix}] ` : "";
      console.log(chalk.gray("🔍"), prefixStr + message);
    }
  }

  startSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.stop();
    }
    this.spinner = ora(message).start();
  }

  updateSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  stopSpinner(success: boolean = true, message?: string): void {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed(message);
      } else {
        this.spinner.fail(message);
      }
      this.spinner = null;
    }
  }

  table(data: Array<Record<string, any>>): void {
    if (data.length === 0) {
      console.log(chalk.gray("No data to display"));
      return;
    }

    const headers = Object.keys(data[0]);
    const maxLengths = headers.map((header) =>
      Math.max(
        header.length,
        ...data.map((row) => String(row[header] || "").length)
      )
    );

    // Print header
    const headerRow = headers
      .map((header, i) => header.padEnd(maxLengths[i]))
      .join(" | ");
    console.log(chalk.cyan(headerRow));
    console.log(chalk.gray("─".repeat(headerRow.length)));

    // Print rows
    data.forEach((row) => {
      const rowString = headers
        .map((header, i) => String(row[header] || "").padEnd(maxLengths[i]))
        .join(" | ");
      console.log(rowString);
    });
  }

  json(data: any): void {
    console.log(JSON.stringify(data, null, 2));
  }

  line(): void {
    console.log("");
  }
}

export const logger = Logger.getInstance();
