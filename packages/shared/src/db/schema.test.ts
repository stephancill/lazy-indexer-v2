import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { getTestDb, closeTestDb } from "./index.js";
import { schema } from "./schema.js";
import { eq, sql } from "drizzle-orm";

describe("Database Schema", () => {
  const testDb = getTestDb();

  beforeAll(async () => {
    // Clean up any existing test data
    await testDb.delete(schema.syncState);
    await testDb.delete(schema.onChainEvents);
    await testDb.delete(schema.usernameProofs);
    await testDb.delete(schema.userData);
    await testDb.delete(schema.verifications);
    await testDb.delete(schema.links);
    await testDb.delete(schema.reactions);
    await testDb.delete(schema.casts);
    // Note: Cannot delete from users table as it's now a materialized view
    await testDb.delete(schema.targetClients);
    await testDb.delete(schema.targets);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await testDb.delete(schema.syncState);
    await testDb.delete(schema.onChainEvents);
    await testDb.delete(schema.usernameProofs);
    await testDb.delete(schema.userData);
    await testDb.delete(schema.verifications);
    await testDb.delete(schema.links);
    await testDb.delete(schema.reactions);
    await testDb.delete(schema.casts);
    // Note: Cannot delete from users table as it's now a materialized view
    await testDb.delete(schema.targetClients);
    await testDb.delete(schema.targets);
  });

  describe("Targets Table", () => {
    it("should insert and retrieve targets", async () => {
      const target = {
        fid: 1,
        isRoot: true,
        addedAt: new Date(),
      };

      await testDb.insert(schema.targets).values(target);

      const retrieved = await testDb
        .select()
        .from(schema.targets)
        .where(eq(schema.targets.fid, 1));

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].fid).toBe(1);
      expect(retrieved[0].isRoot).toBe(true);
      expect(retrieved[0].lastSyncedAt).toBeNull();
    });

    it("should handle target updates", async () => {
      await testDb.insert(schema.targets).values({
        fid: 1,
        isRoot: false,
        addedAt: new Date(),
      });

      const syncTime = new Date();
      await testDb
        .update(schema.targets)
        .set({ lastSyncedAt: syncTime })
        .where(eq(schema.targets.fid, 1));

      const updated = await testDb
        .select()
        .from(schema.targets)
        .where(eq(schema.targets.fid, 1));

      // Verify the date was updated (allow for some precision loss)
      const timeDiff = Math.abs(
        (updated[0].lastSyncedAt?.getTime() || 0) - syncTime.getTime()
      );
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });
  });

  describe("Users Materialized View", () => {
    it("should aggregate user data from userData table", async () => {
      // Insert userData records for a user
      const userDataRecords = [
        {
          hash: "userdata1_username",
          fid: 1,
          type: "username",
          value: "testuser",
          timestamp: new Date(),
        },
        {
          hash: "userdata1_display",
          fid: 1,
          type: "display",
          value: "Test User",
          timestamp: new Date(),
        },
        {
          hash: "userdata1_bio",
          fid: 1,
          type: "bio",
          value: "Test bio",
          timestamp: new Date(),
        },
        {
          hash: "userdata1_pfp",
          fid: 1,
          type: "pfp",
          value: "https://example.com/pfp.jpg",
          timestamp: new Date(),
        },
        {
          hash: "userdata1_eth",
          fid: 1,
          type: "ethereum_address",
          value: "0x1234567890abcdef1234567890abcdef12345678",
          timestamp: new Date(),
        },
      ];

      await testDb.insert(schema.userData).values(userDataRecords);

      // Refresh materialized view
      await testDb.execute(sql`REFRESH MATERIALIZED VIEW users`);

      // Verify materialized view aggregates the data correctly
      const retrieved = await testDb
        .select()
        .from(schema.users)
        .where(eq(schema.users.fid, 1));

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].username).toBe("testuser");
      expect(retrieved[0].displayName).toBe("Test User");
      expect(retrieved[0].bio).toBe("Test bio");
      expect(retrieved[0].pfpUrl).toBe("https://example.com/pfp.jpg");
      expect(retrieved[0].custodyAddress).toBe(
        "0x1234567890abcdef1234567890abcdef12345678"
      );
    });

    it("should handle multiple users with different data", async () => {
      // Insert userData for multiple users
      const userDataRecords = [
        {
          hash: "userdata1_username",
          fid: 1,
          type: "username",
          value: "user1",
          timestamp: new Date(),
        },
        {
          hash: "userdata1_display",
          fid: 1,
          type: "display",
          value: "User One",
          timestamp: new Date(),
        },
        {
          hash: "userdata2_username",
          fid: 2,
          type: "username",
          value: "user2",
          timestamp: new Date(),
        },
        {
          hash: "userdata2_display",
          fid: 2,
          type: "display",
          value: "User Two",
          timestamp: new Date(),
        },
      ];

      await testDb.insert(schema.userData).values(userDataRecords);
      await testDb.execute(sql`REFRESH MATERIALIZED VIEW users`);

      const allUsers = await testDb.select().from(schema.users);
      expect(allUsers).toHaveLength(2);

      const user1 = allUsers.find((u) => u.fid === 1);
      const user2 = allUsers.find((u) => u.fid === 2);

      expect(user1?.username).toBe("user1");
      expect(user1?.displayName).toBe("User One");
      expect(user2?.username).toBe("user2");
      expect(user2?.displayName).toBe("User Two");
    });

    it("should use latest values when multiple userData records exist for same type", async () => {
      // Insert older userData record
      const olderRecord = {
        hash: "userdata1_display_old",
        fid: 1,
        type: "display",
        value: "Old Display Name",
        timestamp: new Date(Date.now() - 10000), // 10 seconds ago
      };

      // Insert newer userData record
      const newerRecord = {
        hash: "userdata1_display_new",
        fid: 1,
        type: "display",
        value: "New Display Name",
        timestamp: new Date(), // now
      };

      await testDb.insert(schema.userData).values([olderRecord, newerRecord]);
      await testDb.execute(sql`REFRESH MATERIALIZED VIEW users`);

      const retrieved = await testDb
        .select()
        .from(schema.users)
        .where(eq(schema.users.fid, 1));

      expect(retrieved).toHaveLength(1);
      // Should use the newer value due to MAX(timestamp) aggregation
      expect(retrieved[0].displayName).toBe("New Display Name");
    });
  });

  describe("Casts Table", () => {
    it("should insert and retrieve casts", async () => {
      const cast = {
        hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        fid: 1,
        text: "This is a test cast",
        timestamp: new Date(),
        embeds: [{ url: "https://example.com" }],
        mentions: [2, 3],
        mentionsPositions: [10, 20],
      };

      await testDb.insert(schema.casts).values(cast);

      const retrieved = await testDb
        .select()
        .from(schema.casts)
        .where(eq(schema.casts.fid, 1));

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].text).toBe("This is a test cast");
      expect(retrieved[0].embeds).toEqual([{ url: "https://example.com" }]);
    });

    it("should handle cast replies", async () => {
      const parentCast = {
        hash: "parent1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        fid: 1,
        text: "Parent cast",
        timestamp: new Date(),
      };

      const replyCast = {
        hash: "reply1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        fid: 2,
        text: "Reply cast",
        parentHash: parentCast.hash,
        parentFid: parentCast.fid,
        timestamp: new Date(),
      };

      await testDb.insert(schema.casts).values([parentCast, replyCast]);

      const replies = await testDb
        .select()
        .from(schema.casts)
        .where(eq(schema.casts.parentFid, 1));

      expect(replies).toHaveLength(1);
      expect(replies[0].text).toBe("Reply cast");
      expect(replies[0].parentHash).toBe(parentCast.hash);
    });
  });

  describe("Reactions Table", () => {
    it("should insert and retrieve reactions", async () => {
      const reaction = {
        hash: "reaction1234567890abcdef1234567890abcdef1234567890abcdef123456",
        fid: 1,
        type: "like",
        targetHash:
          "target1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        targetFid: 2,
        timestamp: new Date(),
      };

      await testDb.insert(schema.reactions).values(reaction);

      const retrieved = await testDb
        .select()
        .from(schema.reactions)
        .where(eq(schema.reactions.fid, 1));

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].type).toBe("like");
      expect(retrieved[0].targetFid).toBe(2);
    });
  });

  describe("Links Table", () => {
    it("should insert and retrieve follows", async () => {
      const link = {
        hash: "link1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        fid: 1,
        targetFid: 2,
        type: "follow",
        timestamp: new Date(),
      };

      await testDb.insert(schema.links).values(link);

      const retrieved = await testDb
        .select()
        .from(schema.links)
        .where(eq(schema.links.fid, 1));

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].type).toBe("follow");
      expect(retrieved[0].targetFid).toBe(2);
    });
  });

  describe("Verifications Table", () => {
    it("should insert and retrieve verifications", async () => {
      const verification = {
        hash: "verify1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        fid: 1,
        address: "0x1234567890abcdef1234567890abcdef12345678",
        protocol: "ethereum",
        timestamp: new Date(),
      };

      await testDb.insert(schema.verifications).values(verification);

      const retrieved = await testDb
        .select()
        .from(schema.verifications)
        .where(eq(schema.verifications.fid, 1));

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].address).toBe(
        "0x1234567890abcdef1234567890abcdef12345678"
      );
      expect(retrieved[0].protocol).toBe("ethereum");
    });
  });

  describe("UserData Table", () => {
    it("should insert and retrieve user data", async () => {
      const userData = {
        hash: "userdata1234567890abcdef1234567890abcdef1234567890abcdef123456",
        fid: 1,
        type: "display",
        value: "Test User",
        timestamp: new Date(),
      };

      await testDb.insert(schema.userData).values(userData);

      const retrieved = await testDb
        .select()
        .from(schema.userData)
        .where(eq(schema.userData.fid, 1));

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].type).toBe("display");
      expect(retrieved[0].value).toBe("Test User");
    });
  });

  describe("OnChainEvents Table", () => {
    it("should insert and retrieve on-chain events", async () => {
      const event = {
        type: "SIGNER_ADD",
        chainId: 10,
        blockNumber: 123456,
        blockHash:
          "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        blockTimestamp: new Date(),
        transactionHash:
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        logIndex: 0,
        fid: 1,
        signerEventBody: {
          key: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          keyType: 1,
          eventType: "ADD",
          metadata: "0x",
          metadataType: 1,
        },
      };

      await testDb.insert(schema.onChainEvents).values(event);

      const retrieved = await testDb
        .select()
        .from(schema.onChainEvents)
        .where(eq(schema.onChainEvents.fid, 1));

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].type).toBe("SIGNER_ADD");
      expect(retrieved[0].chainId).toBe(10);
      expect(retrieved[0].signerEventBody).toEqual(event.signerEventBody);
    });
  });

  describe("SyncState Table", () => {
    it("should insert and retrieve sync state", async () => {
      const syncState = {
        name: "realtime-sync",
        lastEventId: 12345,
        lastSyncedAt: new Date(),
      };

      await testDb.insert(schema.syncState).values(syncState);

      const retrieved = await testDb
        .select()
        .from(schema.syncState)
        .where(eq(schema.syncState.name, "realtime-sync"));

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].name).toBe("realtime-sync");
      expect(retrieved[0].lastEventId).toBe(12345);
    });
  });

  describe("Relationships and Constraints", () => {
    it("should handle duplicate prevention with unique constraints", async () => {
      const target = {
        fid: 1,
        isRoot: true,
        addedAt: new Date(),
      };

      await testDb.insert(schema.targets).values(target);

      // This should not throw an error due to ON CONFLICT DO NOTHING
      await expect(async () => {
        await testDb
          .insert(schema.targets)
          .values(target)
          .onConflictDoNothing()
          .execute();
      }).not.toThrow();
    });

    it("should handle related data properly", async () => {
      // Insert userData records to create a user in the materialized view
      const userDataRecords = [
        {
          hash: "userdata1_username",
          fid: 1,
          type: "username",
          value: "testuser",
          timestamp: new Date(),
        },
        {
          hash: "userdata1_display",
          fid: 1,
          type: "display",
          value: "Test User",
          timestamp: new Date(),
        },
      ];

      await testDb.insert(schema.userData).values(userDataRecords);
      await testDb.execute(sql`REFRESH MATERIALIZED VIEW users`);

      // Insert a cast for that user
      await testDb.insert(schema.casts).values({
        hash: "test1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        fid: 1,
        text: "Test cast",
        timestamp: new Date(),
      });

      // Verify both exist
      const users = await testDb.select().from(schema.users);
      const casts = await testDb.select().from(schema.casts);

      expect(users).toHaveLength(1);
      expect(casts).toHaveLength(1);
      expect(users[0].fid).toBe(1);
      expect(casts[0].fid).toBe(1);
    });
  });
});
