import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Helper functions for managing materialized view migrations
 * since Drizzle doesn't automatically detect materialized view changes
 */

export const USERS_MATERIALIZED_VIEW_SQL = sql`
  SELECT 
    fid,
    MAX(CASE WHEN type = 'username' THEN value END) as username,
    MAX(CASE WHEN type = 'display' THEN value END) as display_name,
    MAX(CASE WHEN type = 'pfp' THEN value END) as pfp_url,
    MAX(CASE WHEN type = 'bio' THEN value END) as bio,
    MAX(CASE WHEN type = 'ethereum_address' THEN value END) as custody_address,
    MAX(timestamp) as synced_at
  FROM user_data
  GROUP BY fid
`;

export async function createUsersMaterializedView(db: PostgresJsDatabase<any>) {
  await db.execute(sql`
    CREATE MATERIALIZED VIEW IF NOT EXISTS users AS ${USERS_MATERIALIZED_VIEW_SQL}
  `);
}

export async function refreshUsersMaterializedView(
  db: PostgresJsDatabase<any>
) {
  await db.execute(sql`REFRESH MATERIALIZED VIEW users`);
}

export async function dropUsersMaterializedView(db: PostgresJsDatabase<any>) {
  await db.execute(sql`DROP MATERIALIZED VIEW IF EXISTS users`);
}

export async function recreateUsersMaterializedView(
  db: PostgresJsDatabase<any>
) {
  await dropUsersMaterializedView(db);
  await createUsersMaterializedView(db);
}
