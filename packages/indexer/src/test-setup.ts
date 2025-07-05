import { getTestDb, closeTestDb } from "@farcaster-indexer/shared";

export const db = getTestDb();

export async function setupTestDb() {
  // Ensure test database is ready - just return success for now
  // Tables will be created by migrations
  console.log("Test database setup - ready");
}

export async function cleanupTestDb() {
  // Clean up all test data - just warn for now since tables may not exist
  console.warn("Test cleanup - skipping table truncation for compatibility");
}

export async function closeTestDatabase() {
  await closeTestDb();
}
