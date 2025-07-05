import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { Queue } from "bullmq";
import { eq } from "drizzle-orm";
import { db, cleanupTestDb, setupTestDb } from "../test-setup.js";
import { config } from "@farcaster-indexer/shared";
import { HubClient, schema } from "@farcaster-indexer/shared";
import { RealtimeWorker } from "../jobs/realtime.js";
import { ProcessorWorker } from "../jobs/processor.js";
import { BackfillWorker } from "../jobs/backfill.js";
import type { FarcasterEvent } from "@farcaster-indexer/shared";

// Mock fetch globally
const mockFetch = vi.fn() as any;
global.fetch = mockFetch;

// Mock BullMQ Queue
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: "mock-job-id" }),
    close: vi.fn().mockResolvedValue(undefined),
    getJobs: vi.fn().mockResolvedValue([]),
    getJobCounts: vi
      .fn()
      .mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 }),
  })),
}));

const { targets, targetClients, casts, reactions, links } = schema;

describe("Full System Integration Tests", () => {
  let backfillQueue: Queue;
  let realtimeQueue: Queue;
  let processorQueue: Queue;
  let _realtimeWorker: RealtimeWorker;
  let processorWorker: ProcessorWorker;
  let backfillWorker: BackfillWorker;

  beforeAll(async () => {
    // Setup test database
    await setupTestDb();

    // Initialize queues
    backfillQueue = new Queue("backfill", {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
      },
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    });

    realtimeQueue = new Queue("realtime", {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
      },
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    });

    processorQueue = new Queue("processor", {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
      },
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    });

    // Initialize workers with hub client
    const hubClient = new HubClient(config.hubs);
    _realtimeWorker = new RealtimeWorker(hubClient);
    processorWorker = new ProcessorWorker();
    backfillWorker = new BackfillWorker(hubClient);
  });

  afterAll(async () => {
    // Clean up queues
    await backfillQueue.close();
    await realtimeQueue.close();
    await processorQueue.close();

    // Clean up test database
    await cleanupTestDb();
  });

  beforeEach(async () => {
    // Clean all queues before each test
    await backfillQueue.obliterate();
    await realtimeQueue.obliterate();
    await processorQueue.obliterate();
  });

  afterEach(async () => {
    // Clean up after each test
    await backfillQueue.drain();
    await realtimeQueue.drain();
    await processorQueue.drain();
  });

  describe("End-to-End Data Flow", () => {
    it("should process a complete user lifecycle", async () => {
      // Test FID 1 - a test user
      const testFid = 1;

      // 1. Add target to system
      await db.insert(targets).values({
        fid: testFid,
        isRoot: true,
        addedAt: new Date(),
        lastSyncedAt: null,
      });

      // 2. Trigger backfill
      const backfillJob = await backfillQueue.add("backfill-target", {
        fid: testFid,
        isRoot: true,
      });

      // 3. Process backfill job
      await backfillWorker.processJob(backfillJob as any);

      // 4. Verify target was marked as synced
      const target = await db
        .select()
        .from(targets)
        .where(eq(targets.fid, testFid))
        .limit(1)
        .then((rows) => rows[0]);

      expect(target?.lastSyncedAt).toBeDefined();

      // 5. Simulate real-time event processing
      const castEvent: FarcasterEvent = {
        type: "MERGE_MESSAGE",
        id: 1001,
        mergeMessageBody: {
          message: {
            data: {
              fid: testFid,
              type: "MESSAGE_TYPE_CAST_ADD",
              timestamp: Math.floor(Date.now() / 1000),
              castAddBody: {
                text: "Integration test cast",
                embeds: [],
                mentions: [],
                mentionsPositions: [],
              },
            },
            hash: "integration-test-hash",
            hashScheme: "HASH_SCHEME_BLAKE3",
            signature: "test-signature",
            signatureScheme: "SIGNATURE_SCHEME_ED25519",
            signer: "test-signer",
          },
        },
      };

      // 6. Process the event
      const processorJob = await processorQueue.add("process-event", {
        event: castEvent,
      });

      await processorWorker.processJob(processorJob as any);

      // 7. Verify cast was stored
      const cast = await db
        .select()
        .from(casts)
        .where(eq(casts.hash, "integration-test-hash"))
        .limit(1)
        .then((rows) => rows[0]);

      expect(cast).toBeDefined();
      expect(cast?.fid).toBe(testFid);
      expect(cast?.text).toBe("Integration test cast");
    });

    it("should handle follow relationships and target expansion", async () => {
      const rootFid = 2;
      const targetFid = 3;

      // 1. Add root target
      await db.insert(targets).values({
        fid: rootFid,
        isRoot: true,
        addedAt: new Date(),
        lastSyncedAt: new Date(),
      });

      // 2. Simulate follow event
      const followEvent: FarcasterEvent = {
        type: "MERGE_MESSAGE",
        id: 1002,
        mergeMessageBody: {
          message: {
            data: {
              fid: rootFid,
              type: "MESSAGE_TYPE_LINK_ADD",
              timestamp: Math.floor(Date.now() / 1000),
              linkBody: {
                type: "follow",
                targetFid: targetFid,
              },
            },
            hash: "follow-hash",
            hashScheme: "HASH_SCHEME_BLAKE3",
            signature: "follow-signature",
            signatureScheme: "SIGNATURE_SCHEME_ED25519",
            signer: "follow-signer",
          },
        },
      };

      // 3. Process follow event
      const processorJob = await processorQueue.add("process-event", {
        event: followEvent,
      });

      await processorWorker.processJob(processorJob as any);

      // 4. Verify follow was stored
      const follow = await db
        .select()
        .from(links)
        .where(eq(links.hash, "follow-hash"))
        .limit(1)
        .then((rows) => rows[0]);

      expect(follow).toBeDefined();
      expect(follow?.fid).toBe(rootFid);
      expect(follow?.targetFid).toBe(targetFid);
      expect(follow?.type).toBe("follow");

      // 5. Verify target was added for followed user
      const newTarget = await db
        .select()
        .from(targets)
        .where(eq(targets.fid, targetFid))
        .limit(1)
        .then((rows) => rows[0]);

      expect(newTarget).toBeDefined();
      expect(newTarget?.isRoot).toBe(false);
    });

    it("should handle reaction events to target casts", async () => {
      const castFid = 4;
      const reactionFid = 5;
      const castHash = "target-cast-hash";

      // 1. Add cast target
      await db.insert(targets).values({
        fid: castFid,
        isRoot: true,
        addedAt: new Date(),
        lastSyncedAt: new Date(),
      });

      // 2. Add a cast first
      await db.insert(casts).values({
        hash: castHash,
        fid: castFid,
        text: "Cast to be liked",
        timestamp: new Date(),
        embeds: [],
        mentions: [],
        mentionsPositions: [],
      });

      // 3. Simulate reaction event
      const reactionEvent: FarcasterEvent = {
        type: "MERGE_MESSAGE",
        id: 1003,
        mergeMessageBody: {
          message: {
            data: {
              fid: reactionFid,
              type: "MESSAGE_TYPE_REACTION_ADD",
              timestamp: Math.floor(Date.now() / 1000),
              reactionBody: {
                type: "LIKE",
                targetCastId: {
                  fid: castFid,
                  hash: castHash,
                },
              },
            },
            hash: "reaction-hash",
            hashScheme: "HASH_SCHEME_BLAKE3",
            signature: "reaction-signature",
            signatureScheme: "SIGNATURE_SCHEME_ED25519",
            signer: "reaction-signer",
          },
        },
      };

      // 4. Process reaction event
      const processorJob = await processorQueue.add("process-event", {
        event: reactionEvent,
      });

      await processorWorker.processJob(processorJob as any);

      // 5. Verify reaction was stored
      const reaction = await db
        .select()
        .from(reactions)
        .where(eq(reactions.hash, "reaction-hash"))
        .limit(1)
        .then((rows) => rows[0]);

      expect(reaction).toBeDefined();
      expect(reaction?.fid).toBe(reactionFid);
      expect(reaction?.type).toBe("like");
      expect(reaction?.targetHash).toBe(castHash);
    });

    it("should handle client discovery events", async () => {
      const clientFid = 6;
      const newUserFid = 7;

      // 1. Add client FID to monitor
      await db.insert(targetClients).values({
        clientFid: clientFid,
        addedAt: new Date(),
      });

      // 2. Simulate signer add event for client
      const signerEvent: FarcasterEvent = {
        type: "MERGE_ON_CHAIN_EVENT",
        id: 1004,
        mergeOnChainEventBody: {
          onChainEvent: {
            type: "EVENT_TYPE_SIGNER_ADD",
            fid: newUserFid,
            chainId: 10,
            blockNumber: 1000,
            blockHash: "block-hash",
            blockTimestamp: Math.floor(Date.now() / 1000),
            transactionHash: "tx-hash",
            logIndex: 1,
            signerEventBody: {
              key: "signer-key",
              keyType: 1,
              eventType: "ADD",
              metadata: `client:${clientFid}`,
              metadataType: 1,
            },
          },
        },
      };

      // 3. Process signer event
      const processorJob = await processorQueue.add("process-event", {
        event: signerEvent,
      });

      await processorWorker.processJob(processorJob as any);

      // 4. Verify new user was added as root target
      const newTarget = await db
        .select()
        .from(targets)
        .where(eq(targets.fid, newUserFid))
        .limit(1)
        .then((rows) => rows[0]);

      expect(newTarget).toBeDefined();
      expect(newTarget?.isRoot).toBe(true);
    });
  });

  describe("System Recovery and Resilience", () => {
    it("should recover from job failures gracefully", async () => {
      // Test job failure and retry logic
      const failingJob = await backfillQueue.add("backfill-target", {
        fid: 999999, // Non-existent FID that will likely fail
        isRoot: false,
      });

      // Process the failing job
      try {
        await backfillWorker.processJob(failingJob as any);
      } catch (error) {
        // Job should fail but not crash the system
        expect(error).toBeDefined();
      }

      // Verify system is still operational
      const testJob = await backfillQueue.add("backfill-target", {
        fid: 1,
        isRoot: true,
      });

      // This should work fine
      await expect(
        backfillWorker.processJob(testJob as any)
      ).resolves.not.toThrow();
    });

    it("should handle database connection issues", async () => {
      // This test would require mocking database failures
      // For now, we'll test that the system doesn't crash with invalid data
      const invalidEvent: FarcasterEvent = {
        type: "MERGE_MESSAGE",
        id: 1005,
        mergeMessageBody: {
          message: {
            data: {
              fid: -1, // Invalid FID
              type: "MESSAGE_TYPE_CAST_ADD",
              timestamp: -1, // Invalid timestamp
              castAddBody: {
                text: "", // Empty text
                embeds: [],
                mentions: [],
                mentionsPositions: [],
              },
            },
            hash: "", // Empty hash
            hashScheme: "HASH_SCHEME_BLAKE3",
            signature: "",
            signatureScheme: "SIGNATURE_SCHEME_ED25519",
            signer: "",
          },
        },
      };

      const processorJob = await processorQueue.add("process-event", {
        event: invalidEvent,
      });

      // Should handle gracefully without crashing
      await expect(
        processorWorker.processJob(processorJob as any)
      ).resolves.not.toThrow();
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle multiple concurrent jobs", async () => {
      const jobPromises = [];

      // Create multiple jobs
      for (let i = 0; i < 10; i++) {
        const job = await processorQueue.add("process-event", {
          event: {
            type: "MERGE_MESSAGE",
            id: 2000 + i,
            mergeMessageBody: {
              message: {
                data: {
                  fid: 10 + i,
                  type: "MESSAGE_TYPE_CAST_ADD",
                  timestamp: Math.floor(Date.now() / 1000),
                  castAddBody: {
                    text: `Concurrent cast ${i}`,
                    embeds: [],
                    mentions: [],
                    mentionsPositions: [],
                  },
                },
                hash: `concurrent-hash-${i}`,
                hashScheme: "HASH_SCHEME_BLAKE3",
                signature: `signature-${i}`,
                signatureScheme: "SIGNATURE_SCHEME_ED25519",
                signer: `signer-${i}`,
              },
            },
          },
        });

        jobPromises.push(processorWorker.processJob(job as any));
      }

      // All jobs should complete successfully
      await expect(Promise.all(jobPromises)).resolves.not.toThrow();
    });
  });
});
