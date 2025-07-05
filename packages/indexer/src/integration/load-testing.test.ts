import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { Queue } from "bullmq";
import { eq, desc, and } from "drizzle-orm";
import { db, cleanupTestDb, setupTestDb } from "../test-setup.js";
import { config, HubClient, schema } from "@farcaster-indexer/shared";
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

const { targets, casts, users, links } = schema;

describe("Load Testing", () => {
  let processorQueue: Queue;
  let backfillQueue: Queue;
  let processorWorker: ProcessorWorker;
  let _backfillWorker: BackfillWorker;

  beforeAll(async () => {
    await setupTestDb();

    processorQueue = new Queue("processor-load", {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
      },
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    });

    backfillQueue = new Queue("backfill-load", {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
      },
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    });

    const hubClient = new HubClient(config.hubs);
    processorWorker = new ProcessorWorker();
    _backfillWorker = new BackfillWorker(hubClient);
  });

  afterAll(async () => {
    await processorQueue.close();
    await backfillQueue.close();
    await cleanupTestDb();
  });

  beforeEach(async () => {
    await processorQueue.obliterate();
    await backfillQueue.obliterate();
  });

  describe("High-Volume Event Processing", () => {
    it("should handle 1000 cast events efficiently", async () => {
      const startTime = Date.now();
      const numEvents = 1000;
      const jobPromises = [];

      // Create 1000 cast events
      for (let i = 0; i < numEvents; i++) {
        const castEvent: FarcasterEvent = {
          type: "MERGE_MESSAGE",
          id: 3000 + i,
          mergeMessageBody: {
            message: {
              data: {
                fid: 100 + (i % 100), // Distribute across 100 users
                type: "MESSAGE_TYPE_CAST_ADD",
                timestamp: Math.floor(Date.now() / 1000) + i,
                castAddBody: {
                  text: `Load test cast ${i}`,
                  embeds: [],
                  mentions: [],
                  mentionsPositions: [],
                },
              },
              hash: `load-test-hash-${i}`,
              hashScheme: "HASH_SCHEME_BLAKE3",
              signature: `load-test-signature-${i}`,
              signatureScheme: "SIGNATURE_SCHEME_ED25519",
              signer: `load-test-signer-${i}`,
            },
          },
        };

        const job = await processorQueue.add("process-event", {
          event: castEvent,
        });

        jobPromises.push(processorWorker.processJob(job as any));
      }

      // Process all events
      await Promise.all(jobPromises);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process 1000 events in under 30 seconds
      expect(processingTime).toBeLessThan(30000);

      // Verify events per second
      const eventsPerSecond = numEvents / (processingTime / 1000);
      console.log(
        `Processed ${numEvents} events in ${processingTime}ms (${eventsPerSecond.toFixed(
          2
        )} events/second)`
      );

      // Should handle at least 50 events per second
      expect(eventsPerSecond).toBeGreaterThan(50);
    });

    it("should handle 500 reaction events efficiently", async () => {
      const startTime = Date.now();
      const numEvents = 500;
      const jobPromises = [];

      // Create target casts first
      for (let i = 0; i < 10; i++) {
        await db.insert(casts).values({
          hash: `target-cast-${i}`,
          fid: 200 + i,
          text: `Target cast ${i}`,
          timestamp: new Date(),
          embeds: [],
          mentions: [],
          mentionsPositions: [],
        });
      }

      // Create 500 reaction events
      for (let i = 0; i < numEvents; i++) {
        const reactionEvent: FarcasterEvent = {
          type: "MERGE_MESSAGE",
          id: 4000 + i,
          mergeMessageBody: {
            message: {
              data: {
                fid: 300 + (i % 50), // Distribute across 50 users
                type: "MESSAGE_TYPE_REACTION_ADD",
                timestamp: Math.floor(Date.now() / 1000) + i,
                reactionBody: {
                  type: i % 2 === 0 ? "LIKE" : "RECAST",
                  targetCastId: {
                    fid: 200 + (i % 10),
                    hash: `target-cast-${i % 10}`,
                  },
                },
              },
              hash: `reaction-load-test-${i}`,
              hashScheme: "HASH_SCHEME_BLAKE3",
              signature: `reaction-signature-${i}`,
              signatureScheme: "SIGNATURE_SCHEME_ED25519",
              signer: `reaction-signer-${i}`,
            },
          },
        };

        const job = await processorQueue.add("process-event", {
          event: reactionEvent,
        });

        jobPromises.push(processorWorker.processJob(job as any));
      }

      // Process all events
      await Promise.all(jobPromises);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process 500 reactions in under 15 seconds
      expect(processingTime).toBeLessThan(15000);

      const eventsPerSecond = numEvents / (processingTime / 1000);
      console.log(
        `Processed ${numEvents} reactions in ${processingTime}ms (${eventsPerSecond.toFixed(
          2
        )} reactions/second)`
      );

      // Should handle at least 40 reactions per second
      expect(eventsPerSecond).toBeGreaterThan(40);
    });

    it("should handle 200 follow events efficiently", async () => {
      const startTime = Date.now();
      const numEvents = 200;
      const jobPromises = [];

      // Create 200 follow events
      for (let i = 0; i < numEvents; i++) {
        const followEvent: FarcasterEvent = {
          type: "MERGE_MESSAGE",
          id: 5000 + i,
          mergeMessageBody: {
            message: {
              data: {
                fid: 400 + (i % 20), // 20 users following others
                type: "MESSAGE_TYPE_LINK_ADD",
                timestamp: Math.floor(Date.now() / 1000) + i,
                linkBody: {
                  type: "follow",
                  targetFid: 500 + (i % 100), // Following 100 different users
                },
              },
              hash: `follow-load-test-${i}`,
              hashScheme: "HASH_SCHEME_BLAKE3",
              signature: `follow-signature-${i}`,
              signatureScheme: "SIGNATURE_SCHEME_ED25519",
              signer: `follow-signer-${i}`,
            },
          },
        };

        const job = await processorQueue.add("process-event", {
          event: followEvent,
        });

        jobPromises.push(processorWorker.processJob(job as any));
      }

      // Process all events
      await Promise.all(jobPromises);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process 200 follows in under 10 seconds
      expect(processingTime).toBeLessThan(10000);

      const eventsPerSecond = numEvents / (processingTime / 1000);
      console.log(
        `Processed ${numEvents} follows in ${processingTime}ms (${eventsPerSecond.toFixed(
          2
        )} follows/second)`
      );

      // Should handle at least 25 follows per second
      expect(eventsPerSecond).toBeGreaterThan(25);
    });
  });

  describe("Database Performance", () => {
    it("should handle bulk inserts efficiently", async () => {
      const startTime = Date.now();
      const numTargets = 1000;

      // Prepare bulk insert data
      const targetData = [];
      for (let i = 0; i < numTargets; i++) {
        targetData.push({
          fid: 1000 + i,
          isRoot: i % 10 === 0, // Every 10th target is root
          addedAt: new Date(),
          lastSyncedAt: null,
        });
      }

      // Bulk insert
      await db.insert(targets).values(targetData);

      const endTime = Date.now();
      const insertTime = endTime - startTime;

      // Should insert 1000 targets in under 5 seconds
      expect(insertTime).toBeLessThan(5000);

      const insertsPerSecond = numTargets / (insertTime / 1000);
      console.log(
        `Inserted ${numTargets} targets in ${insertTime}ms (${insertsPerSecond.toFixed(
          2
        )} inserts/second)`
      );

      // Should handle at least 200 inserts per second
      expect(insertsPerSecond).toBeGreaterThan(200);

      // Verify all targets were inserted
      const count = await db
        .select()
        .from(targets)
        .then((rows) => rows.length);
      expect(count).toBeGreaterThanOrEqual(numTargets);
    });

    it("should handle complex queries efficiently", async () => {
      // Insert test data
      const testFids = [2000, 2001, 2002, 2003, 2004];

      // Insert users
      for (const fid of testFids) {
        await db.insert(users).values({
          fid,
          username: `user${fid}`,
          displayName: `User ${fid}`,
          pfpUrl: `https://example.com/pfp${fid}`,
          bio: `Bio for user ${fid}`,
          custodyAddress: `0x${fid.toString(16).padStart(40, "0")}`,
          syncedAt: new Date(),
        });
      }

      // Insert follows
      for (let i = 0; i < testFids.length - 1; i++) {
        await db.insert(links).values({
          hash: `follow-${i}`,
          fid: testFids[i],
          targetFid: testFids[i + 1],
          type: "follow",
          timestamp: new Date(),
        });
      }

      // Insert casts
      for (const fid of testFids) {
        for (let i = 0; i < 10; i++) {
          await db.insert(casts).values({
            hash: `cast-${fid}-${i}`,
            fid,
            text: `Cast ${i} from user ${fid}`,
            timestamp: new Date(Date.now() - i * 60000), // 1 minute intervals
            embeds: [],
            mentions: [],
            mentionsPositions: [],
          });
        }
      }

      const startTime = Date.now();

      // Complex query: Get feed for user 2000 (casts from users they follow)
      const feedQuery = await db
        .select({
          castHash: casts.hash,
          castText: casts.text,
          castFid: casts.fid,
          castTimestamp: casts.timestamp,
          authorUsername: users.username,
          authorDisplayName: users.displayName,
        })
        .from(casts)
        .innerJoin(users, eq(casts.fid, users.fid))
        .innerJoin(links, eq(casts.fid, links.targetFid))
        .where(and(eq(links.fid, 2000), eq(links.type, "follow")))
        .orderBy(desc(casts.timestamp))
        .limit(20);

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      // Should execute complex query in under 100ms
      expect(queryTime).toBeLessThan(100);

      console.log(`Complex feed query executed in ${queryTime}ms`);

      // Should return some results
      expect(feedQuery.length).toBeGreaterThan(0);
    });
  });

  describe("Memory Usage", () => {
    it("should handle large batches without memory leaks", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process 100 batches of 10 events each
      for (let batch = 0; batch < 100; batch++) {
        const batchPromises = [];

        for (let i = 0; i < 10; i++) {
          const eventId = batch * 10 + i;
          const castEvent: FarcasterEvent = {
            type: "MERGE_MESSAGE",
            id: 6000 + eventId,
            mergeMessageBody: {
              message: {
                data: {
                  fid: 600 + (eventId % 50),
                  type: "MESSAGE_TYPE_CAST_ADD",
                  timestamp: Math.floor(Date.now() / 1000) + eventId,
                  castAddBody: {
                    text: `Memory test cast ${eventId}`,
                    embeds: [],
                    mentions: [],
                    mentionsPositions: [],
                  },
                },
                hash: `memory-test-${eventId}`,
                hashScheme: "HASH_SCHEME_BLAKE3",
                signature: `memory-signature-${eventId}`,
                signatureScheme: "SIGNATURE_SCHEME_ED25519",
                signer: `memory-signer-${eventId}`,
              },
            },
          };

          const job = await processorQueue.add("process-event", {
            event: castEvent,
          });

          batchPromises.push(processorWorker.processJob(job as any));
        }

        await Promise.all(batchPromises);

        // Force garbage collection between batches
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)} MB`);

      // Memory increase should be reasonable (under 100MB for 1000 events)
      expect(memoryIncreaseMB).toBeLessThan(100);
    });
  });

  describe("Concurrent Processing", () => {
    it("should handle multiple concurrent workers", async () => {
      const startTime = Date.now();
      const numWorkers = 5;
      const eventsPerWorker = 50;

      // Create multiple workers
      const workers = Array.from(
        { length: numWorkers },
        () => new ProcessorWorker()
      );
      const workerPromises = [];

      for (let workerId = 0; workerId < numWorkers; workerId++) {
        const workerPromise = (async () => {
          const jobPromises = [];

          for (let i = 0; i < eventsPerWorker; i++) {
            const eventId = workerId * eventsPerWorker + i;
            const castEvent: FarcasterEvent = {
              type: "MERGE_MESSAGE",
              id: 7000 + eventId,
              mergeMessageBody: {
                message: {
                  data: {
                    fid: 700 + eventId,
                    type: "MESSAGE_TYPE_CAST_ADD",
                    timestamp: Math.floor(Date.now() / 1000) + eventId,
                    castAddBody: {
                      text: `Concurrent cast ${eventId} from worker ${workerId}`,
                      embeds: [],
                      mentions: [],
                      mentionsPositions: [],
                    },
                  },
                  hash: `concurrent-${workerId}-${i}`,
                  hashScheme: "HASH_SCHEME_BLAKE3",
                  signature: `concurrent-signature-${eventId}`,
                  signatureScheme: "SIGNATURE_SCHEME_ED25519",
                  signer: `concurrent-signer-${eventId}`,
                },
              },
            };

            const job = await processorQueue.add("process-event", {
              event: castEvent,
            });

            jobPromises.push(workers[workerId].processJob(job as any));
          }

          await Promise.all(jobPromises);
        })();

        workerPromises.push(workerPromise);
      }

      // Wait for all workers to complete
      await Promise.all(workerPromises);

      const endTime = Date.now();
      const processingTime = endTime - startTime;
      const totalEvents = numWorkers * eventsPerWorker;

      // Should process all events in under 15 seconds
      expect(processingTime).toBeLessThan(15000);

      const eventsPerSecond = totalEvents / (processingTime / 1000);
      console.log(
        `${numWorkers} workers processed ${totalEvents} events in ${processingTime}ms (${eventsPerSecond.toFixed(
          2
        )} events/second)`
      );

      // Concurrent processing should be faster than sequential
      expect(eventsPerSecond).toBeGreaterThan(60);
    });
  });
});
