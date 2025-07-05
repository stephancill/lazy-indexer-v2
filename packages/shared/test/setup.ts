import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { getTestDb, closeTestDb } from "../src/db/index.js";
import { sql } from "drizzle-orm";

export const db = getTestDb();

beforeAll(() => {
  process.env.NODE_ENV = "test";
});

afterAll(async () => {
  await closeTestDb();
  delete process.env.NODE_ENV;
});

beforeEach(() => {
  // Reset any mocks or test state before each test
});

afterEach(() => {
  // Cleanup after each test
});

export async function setupTestDb() {
  // Ensure test database is ready
  await db.execute(sql`SELECT 1`);
}

export async function cleanupTestDb() {
  // Clean up all test data
  try {
    await db.execute(sql`TRUNCATE TABLE 
      targets, target_clients, users, casts, reactions, 
      links, verifications, user_data, username_proofs, 
      on_chain_events, sync_state 
      RESTART IDENTITY CASCADE`);
  } catch (error) {
    // Ignore errors during cleanup
    console.warn("Test cleanup warning:", error);
  }
}
