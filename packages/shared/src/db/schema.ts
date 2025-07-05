import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  jsonb,
  varchar,
  bigint,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

// Targets table - manages the set of FIDs to be indexed
export const targets = pgTable(
  "targets",
  {
    fid: integer("fid").primaryKey(),
    isRoot: boolean("is_root").notNull().default(false),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  },
  (table) => ({
    isRootIdx: index("targets_is_root_idx").on(table.isRoot),
    lastSyncedIdx: index("targets_last_synced_idx").on(table.lastSyncedAt),
  })
);

// Target clients table - stores client FIDs to monitor for discovering new root targets
export const targetClients = pgTable("target_clients", {
  clientFid: integer("client_fid").primaryKey(),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

// Users table - stores user profile data
export const users = pgTable(
  "users",
  {
    fid: integer("fid").primaryKey(),
    username: varchar("username", { length: 100 }),
    displayName: text("display_name"),
    pfpUrl: text("pfp_url"),
    bio: text("bio"),
    custodyAddress: varchar("custody_address", { length: 42 }),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    usernameIdx: index("users_username_idx").on(table.username),
    syncedAtIdx: index("users_synced_at_idx").on(table.syncedAt),
  })
);

// Casts table - stores cast messages
export const casts = pgTable(
  "casts",
  {
    hash: varchar("hash", { length: 64 }).primaryKey(),
    fid: integer("fid").notNull(),
    text: text("text"),
    parentHash: varchar("parent_hash", { length: 64 }),
    parentFid: integer("parent_fid"),
    parentUrl: text("parent_url"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    embeds: jsonb("embeds"),
    mentions: jsonb("mentions"),
    mentionsPositions: jsonb("mentions_positions"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    fidIdx: index("casts_fid_idx").on(table.fid),
    timestampIdx: index("casts_timestamp_idx").on(table.timestamp),
    parentHashIdx: index("casts_parent_hash_idx").on(table.parentHash),
    parentFidIdx: index("casts_parent_fid_idx").on(table.parentFid),
    fidTimestampIdx: index("casts_fid_timestamp_idx").on(
      table.fid,
      table.timestamp
    ),
  })
);

// Reactions table - stores likes and recasts
export const reactions = pgTable(
  "reactions",
  {
    hash: varchar("hash", { length: 64 }).primaryKey(),
    fid: integer("fid").notNull(),
    type: varchar("type", { length: 10 }).notNull(), // 'like' or 'recast'
    targetHash: varchar("target_hash", { length: 64 }),
    targetFid: integer("target_fid"),
    targetUrl: text("target_url"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    fidIdx: index("reactions_fid_idx").on(table.fid),
    typeIdx: index("reactions_type_idx").on(table.type),
    targetHashIdx: index("reactions_target_hash_idx").on(table.targetHash),
    targetFidIdx: index("reactions_target_fid_idx").on(table.targetFid),
    fidTypeIdx: index("reactions_fid_type_idx").on(table.fid, table.type),
    timestampIdx: index("reactions_timestamp_idx").on(table.timestamp),
  })
);

// Links table - stores follows and unfollows
export const links = pgTable(
  "links",
  {
    hash: varchar("hash", { length: 64 }).primaryKey(),
    fid: integer("fid").notNull(),
    targetFid: integer("target_fid").notNull(),
    type: varchar("type", { length: 10 }).notNull(), // 'follow' or 'unfollow'
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    fidIdx: index("links_fid_idx").on(table.fid),
    targetFidIdx: index("links_target_fid_idx").on(table.targetFid),
    typeIdx: index("links_type_idx").on(table.type),
    fidTargetIdx: index("links_fid_target_idx").on(table.fid, table.targetFid),
    timestampIdx: index("links_timestamp_idx").on(table.timestamp),
  })
);

// Verifications table - stores verified addresses
export const verifications = pgTable(
  "verifications",
  {
    hash: varchar("hash", { length: 64 }).primaryKey(),
    fid: integer("fid").notNull(),
    address: varchar("address", { length: 42 }).notNull(),
    protocol: varchar("protocol", { length: 20 }).notNull().default("ethereum"),
    blockHash: varchar("block_hash", { length: 66 }),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    fidIdx: index("verifications_fid_idx").on(table.fid),
    addressIdx: index("verifications_address_idx").on(table.address),
    protocolIdx: index("verifications_protocol_idx").on(table.protocol),
    timestampIdx: index("verifications_timestamp_idx").on(table.timestamp),
  })
);

// User data table - stores user profile information messages
export const userData = pgTable(
  "user_data",
  {
    hash: varchar("hash", { length: 64 }).primaryKey(),
    fid: integer("fid").notNull(),
    type: varchar("type", { length: 20 }).notNull(), // 'pfp', 'display', 'bio', 'url', 'username'
    value: text("value").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    fidIdx: index("user_data_fid_idx").on(table.fid),
    typeIdx: index("user_data_type_idx").on(table.type),
    fidTypeIdx: index("user_data_fid_type_idx").on(table.fid, table.type),
    timestampIdx: index("user_data_timestamp_idx").on(table.timestamp),
  })
);

// Username proofs table - stores username proof messages
export const usernameProofs = pgTable(
  "username_proofs",
  {
    hash: varchar("hash", { length: 64 }).primaryKey(),
    fid: integer("fid").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    owner: varchar("owner", { length: 42 }).notNull(),
    signature: text("signature").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    fidIdx: index("username_proofs_fid_idx").on(table.fid),
    nameIdx: index("username_proofs_name_idx").on(table.name),
    ownerIdx: index("username_proofs_owner_idx").on(table.owner),
    timestampIdx: index("username_proofs_timestamp_idx").on(table.timestamp),
  })
);

// On-chain events table - stores blockchain events (signer add/remove, fid transfer, etc.)
export const onChainEvents = pgTable(
  "on_chain_events",
  {
    id: serial("id").primaryKey(),
    type: varchar("type", { length: 50 }).notNull(),
    chainId: integer("chain_id").notNull(),
    blockNumber: bigint("block_number", { mode: "number" }).notNull(),
    blockHash: varchar("block_hash", { length: 66 }).notNull(),
    blockTimestamp: timestamp("block_timestamp", {
      withTimezone: true,
    }).notNull(),
    transactionHash: varchar("transaction_hash", { length: 66 }).notNull(),
    logIndex: integer("log_index").notNull(),
    fid: integer("fid").notNull(),
    signerEventBody: jsonb("signer_event_body"),
    idRegistryEventBody: jsonb("id_registry_event_body"),
    keyRegistryEventBody: jsonb("key_registry_event_body"),
    storageRentEventBody: jsonb("storage_rent_event_body"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    typeIdx: index("on_chain_events_type_idx").on(table.type),
    fidIdx: index("on_chain_events_fid_idx").on(table.fid),
    blockNumberIdx: index("on_chain_events_block_number_idx").on(
      table.blockNumber
    ),
    blockTimestampIdx: index("on_chain_events_block_timestamp_idx").on(
      table.blockTimestamp
    ),
    transactionHashIdx: index("on_chain_events_transaction_hash_idx").on(
      table.transactionHash
    ),
    chainIdBlockIdx: index("on_chain_events_chain_id_block_idx").on(
      table.chainId,
      table.blockNumber
    ),
  })
);

// Sync state table - tracks synchronization state for various operations
export const syncState = pgTable("sync_state", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  lastEventId: bigint("last_event_id", { mode: "number" }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Export all tables for use in migrations and queries
export const schema = {
  targets,
  targetClients,
  users,
  casts,
  reactions,
  links,
  verifications,
  userData,
  usernameProofs,
  onChainEvents,
  syncState,
};

// Export types for use in application code
export type Target = typeof targets.$inferSelect;
export type NewTarget = typeof targets.$inferInsert;

export type TargetClient = typeof targetClients.$inferSelect;
export type NewTargetClient = typeof targetClients.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Cast = typeof casts.$inferSelect;
export type NewCast = typeof casts.$inferInsert;

export type Reaction = typeof reactions.$inferSelect;
export type NewReaction = typeof reactions.$inferInsert;

export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;

export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;

export type UserData = typeof userData.$inferSelect;
export type NewUserData = typeof userData.$inferInsert;

export type UsernameProof = typeof usernameProofs.$inferSelect;
export type NewUsernameProof = typeof usernameProofs.$inferInsert;

export type OnChainEvent = typeof onChainEvents.$inferSelect;
export type NewOnChainEvent = typeof onChainEvents.$inferInsert;

export type SyncState = typeof syncState.$inferSelect;
export type NewSyncState = typeof syncState.$inferInsert;
