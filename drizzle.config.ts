import type { Config } from "drizzle-kit";

export default {
  schema: "./packages/shared/src/db/schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString:
      process.env.DATABASE_URL ||
      "postgres://postgres:password@localhost:5432/postgres",
  },
} satisfies Config;
