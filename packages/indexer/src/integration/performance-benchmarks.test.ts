import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";

// Mock fetch globally
const mockFetch = vi.fn() as any;
global.fetch = mockFetch;
import {
  benchmarks,
  generatePerformanceReport,
  validatePerformance,
  PERFORMANCE_THRESHOLDS,
  BenchmarkSuiteRunner,
  SystemMonitor,
} from "../performance/benchmarks.js";
import { db, setupTestDb, cleanupTestDb } from "../test-setup.js";
import { ProcessorWorker } from "../jobs/processor.js";
import { config, HubClient, schema } from "@farcaster-indexer/shared";
import type { FarcasterEvent } from "@farcaster-indexer/shared";

const { casts, users, targets } = schema;

describe("Performance Benchmarks", () => {
  let _hubClient: HubClient;
  let processorWorker: ProcessorWorker;
  let monitor: SystemMonitor;

  beforeAll(async () => {
    await setupTestDb();
    _hubClient = new HubClient(config.hubs);
    processorWorker = new ProcessorWorker();
    monitor = new SystemMonitor();

    // Start system monitoring
    monitor.start(1000); // Monitor every second
  });

  afterAll(async () => {
    monitor.stop();
    await cleanupTestDb();

    // Generate final performance report
    console.log(generatePerformanceReport());

    // Validate performance against thresholds
    const validation = validatePerformance();
    if (!validation.passed) {
      console.warn("⚠️ Performance validation failed:", validation.failures);
    }
    if (validation.warnings.length > 0) {
      console.warn("⚠️ Performance warnings:", validation.warnings);
    }
  });

  beforeEach(async () => {
    // Clear benchmark results before each test
    benchmarks.database.clear();
    benchmarks.jobs.clear();
  });

  describe("Database Performance", () => {
    it("should benchmark single insert operations", async () => {
      const testData = {
        fid: 1001,
        isRoot: true,
        addedAt: new Date(),
        lastSyncedAt: null,
      };

      const result = await benchmarks.database.benchmarkInsert(
        "Single Target Insert",
        async () => {
          return await db.insert(targets).values(testData);
        }
      );

      expect(result).toBeDefined();

      const benchmarkResults = benchmarks.database.getResults();
      expect(benchmarkResults.results).toHaveLength(1);
      expect(benchmarkResults.results[0].duration).toBeLessThan(
        PERFORMANCE_THRESHOLDS.DATABASE_INSERT_MAX
      );
    });

    it("should benchmark bulk insert operations", async () => {
      const testData = Array.from({ length: 100 }, (_, i) => ({
        fid: 2000 + i,
        isRoot: i % 10 === 0,
        addedAt: new Date(),
        lastSyncedAt: null,
      }));

      const result = await benchmarks.database.benchmarkInsert(
        "Bulk Target Insert (100 records)",
        async () => {
          return await db.insert(targets).values(testData);
        }
      );

      expect(result).toBeDefined();

      const benchmarkResults = benchmarks.database.getResults();
      const bulkInsert = benchmarkResults.results.find((r) =>
        r.name.includes("Bulk")
      );
      expect(bulkInsert?.duration).toBeLessThan(
        PERFORMANCE_THRESHOLDS.DATABASE_BULK_INSERT_MAX
      );
    });

    it("should benchmark complex queries", async () => {
      // Insert test data first
      const testUsers = Array.from({ length: 50 }, (_, i) => ({
        fid: 3000 + i,
        username: `user${3000 + i}`,
        displayName: `User ${3000 + i}`,
        pfpUrl: `https://example.com/pfp${3000 + i}`,
        bio: `Bio for user ${3000 + i}`,
        custodyAddress: `0x${(3000 + i).toString(16).padStart(40, "0")}`,
        syncedAt: new Date(),
      }));

      await db.insert(users).values(testUsers);

      const testCasts = Array.from({ length: 200 }, (_, i) => ({
        hash: `cast-${3000 + i}`,
        fid: 3000 + (i % 50), // Distribute across users
        text: `Performance test cast ${i}`,
        timestamp: new Date(Date.now() - i * 60000),
        embeds: [],
        mentions: [],
        mentionsPositions: [],
      }));

      await db.insert(casts).values(testCasts);

      // Benchmark complex query
      const result = await benchmarks.database.benchmarkQuery(
        "Complex Feed Query",
        async () => {
          return await db
            .select({
              castHash: casts.hash,
              castText: casts.text,
              castFid: casts.fid,
              castTimestamp: casts.timestamp,
              authorUsername: users.username,
              authorDisplayName: users.displayName,
            })
            .from(casts)
            .innerJoin(users, (eq) => eq(casts.fid, users.fid))
            .where((gte) =>
              gte(casts.timestamp, new Date(Date.now() - 24 * 60 * 60 * 1000))
            )
            .orderBy((desc) => desc(casts.timestamp))
            .limit(50);
        }
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      const benchmarkResults = benchmarks.database.getResults();
      const complexQuery = benchmarkResults.results.find((r) =>
        r.name.includes("Complex Feed")
      );
      expect(complexQuery?.duration).toBeLessThan(
        PERFORMANCE_THRESHOLDS.DATABASE_QUERY_MAX
      );
    });

    it("should benchmark concurrent database operations", async () => {
      const concurrentOps = Array.from({ length: 10 }, (_, i) =>
        benchmarks.database.benchmarkInsert(
          `Concurrent Insert ${i}`,
          async () => {
            return await db.insert(targets).values({
              fid: 4000 + i,
              isRoot: false,
              addedAt: new Date(),
              lastSyncedAt: null,
            });
          }
        )
      );

      const results = await Promise.all(concurrentOps);
      expect(results).toHaveLength(10);

      const benchmarkResults = benchmarks.database.getResults();
      expect(benchmarkResults.results).toHaveLength(10);

      // All concurrent operations should complete within reasonable time
      for (const result of benchmarkResults.results) {
        expect(result.duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.DATABASE_INSERT_MAX * 2
        );
      }
    });
  });

  describe("Job Processing Performance", () => {
    it("should benchmark event processing", async () => {
      const testEvent: FarcasterEvent = {
        type: "MERGE_MESSAGE",
        id: 5001,
        mergeMessageBody: {
          message: {
            data: {
              fid: 5001,
              type: "MESSAGE_TYPE_CAST_ADD",
              timestamp: Math.floor(Date.now() / 1000),
              castAddBody: {
                text: "Performance test cast",
                embeds: [],
                mentions: [],
                mentionsPositions: [],
              },
            },
            hash: "perf-test-hash",
            hashScheme: "HASH_SCHEME_BLAKE3",
            signature: "perf-test-signature",
            signatureScheme: "SIGNATURE_SCHEME_ED25519",
            signer: "perf-test-signer",
          },
        },
      };

      const job = {
        data: { event: testEvent },
      };

      const result = await benchmarks.jobs.benchmarkJob(
        "Process Cast Event",
        async () => {
          return await processorWorker.processJob(job as any);
        }
      );

      expect(result).toBeDefined();

      const benchmarkResults = benchmarks.jobs.getResults();
      expect(benchmarkResults.results).toHaveLength(1);
      expect(benchmarkResults.results[0].duration).toBeLessThan(
        PERFORMANCE_THRESHOLDS.JOB_PROCESS_EVENT_MAX
      );
    });

    it("should benchmark batch event processing", async () => {
      const batchSize = 50;
      const events = Array.from({ length: batchSize }, (_, i) => ({
        type: "MERGE_MESSAGE" as const,
        id: 6000 + i,
        mergeMessageBody: {
          message: {
            data: {
              fid: 6000 + i,
              type: "MESSAGE_TYPE_CAST_ADD" as const,
              timestamp: Math.floor(Date.now() / 1000) + i,
              castAddBody: {
                text: `Batch test cast ${i}`,
                embeds: [],
                mentions: [],
                mentionsPositions: [],
              },
            },
            hash: `batch-hash-${i}`,
            hashScheme: "HASH_SCHEME_BLAKE3" as const,
            signature: `batch-signature-${i}`,
            signatureScheme: "SIGNATURE_SCHEME_ED25519" as const,
            signer: `batch-signer-${i}`,
          },
        },
      }));

      const result = await benchmarks.jobs.benchmarkJob(
        `Batch Process ${batchSize} Events`,
        async () => {
          const promises = events.map((event) =>
            processorWorker.processJob({ data: { event } } as any)
          );
          return await Promise.all(promises);
        }
      );

      expect(result).toHaveLength(batchSize);

      const benchmarkResults = benchmarks.jobs.getResults();
      const batchJob = benchmarkResults.results.find((r) =>
        r.name.includes("Batch Process")
      );

      // Batch processing should be efficient per event
      const averageTimePerEvent = batchJob?.duration / batchSize;
      expect(averageTimePerEvent).toBeLessThan(
        PERFORMANCE_THRESHOLDS.JOB_PROCESS_EVENT_MAX
      );
    });

    it("should benchmark different event types", async () => {
      const eventTypes = [
        {
          name: "Cast Event",
          event: {
            type: "MERGE_MESSAGE" as const,
            id: 7001,
            mergeMessageBody: {
              message: {
                data: {
                  fid: 7001,
                  type: "MESSAGE_TYPE_CAST_ADD" as const,
                  timestamp: Math.floor(Date.now() / 1000),
                  castAddBody: {
                    text: "Type benchmark cast",
                    embeds: [],
                    mentions: [],
                    mentionsPositions: [],
                  },
                },
                hash: "type-test-cast",
                hashScheme: "HASH_SCHEME_BLAKE3" as const,
                signature: "type-test-signature",
                signatureScheme: "SIGNATURE_SCHEME_ED25519" as const,
                signer: "type-test-signer",
              },
            },
          },
        },
        {
          name: "Reaction Event",
          event: {
            type: "MERGE_MESSAGE" as const,
            id: 7002,
            mergeMessageBody: {
              message: {
                data: {
                  fid: 7002,
                  type: "MESSAGE_TYPE_REACTION_ADD" as const,
                  timestamp: Math.floor(Date.now() / 1000),
                  reactionBody: {
                    type: "LIKE" as const,
                    targetCastId: {
                      fid: 7001,
                      hash: "type-test-cast",
                    },
                  },
                },
                hash: "type-test-reaction",
                hashScheme: "HASH_SCHEME_BLAKE3" as const,
                signature: "type-test-reaction-sig",
                signatureScheme: "SIGNATURE_SCHEME_ED25519" as const,
                signer: "type-test-reaction-signer",
              },
            },
          },
        },
        {
          name: "Link Event",
          event: {
            type: "MERGE_MESSAGE" as const,
            id: 7003,
            mergeMessageBody: {
              message: {
                data: {
                  fid: 7003,
                  type: "MESSAGE_TYPE_LINK_ADD" as const,
                  timestamp: Math.floor(Date.now() / 1000),
                  linkBody: {
                    type: "follow" as const,
                    targetFid: 7001,
                  },
                },
                hash: "type-test-link",
                hashScheme: "HASH_SCHEME_BLAKE3" as const,
                signature: "type-test-link-sig",
                signatureScheme: "SIGNATURE_SCHEME_ED25519" as const,
                signer: "type-test-link-signer",
              },
            },
          },
        },
      ];

      for (const { name, event } of eventTypes) {
        await benchmarks.jobs.benchmarkJob(name, async () => {
          return await processorWorker.processJob({ data: { event } } as any);
        });
      }

      const benchmarkResults = benchmarks.jobs.getResults();
      expect(benchmarkResults.results).toHaveLength(3);

      // All event types should process efficiently
      for (const result of benchmarkResults.results) {
        expect(result.duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.JOB_PROCESS_EVENT_MAX
        );
      }
    });
  });

  describe("Memory Performance", () => {
    it("should monitor memory usage during processing", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process many events to test memory usage
      const numEvents = 100;
      for (let i = 0; i < numEvents; i++) {
        const event: FarcasterEvent = {
          type: "MERGE_MESSAGE",
          id: 8000 + i,
          mergeMessageBody: {
            message: {
              data: {
                fid: 8000 + i,
                type: "MESSAGE_TYPE_CAST_ADD",
                timestamp: Math.floor(Date.now() / 1000) + i,
                castAddBody: {
                  text: `Memory test cast ${i}`,
                  embeds: [],
                  mentions: [],
                  mentionsPositions: [],
                },
              },
              hash: `memory-test-${i}`,
              hashScheme: "HASH_SCHEME_BLAKE3",
              signature: `memory-signature-${i}`,
              signatureScheme: "SIGNATURE_SCHEME_ED25519",
              signer: `memory-signer-${i}`,
            },
          },
        };

        await processorWorker.processJob({ data: { event } } as any);

        // Force garbage collection every 25 events if available
        if (i % 25 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / (1024 * 1024); // MB

      console.log(
        `Memory growth after processing ${numEvents} events: ${memoryGrowth.toFixed(
          2
        )}MB`
      );

      // Memory growth should be reasonable
      expect(memoryGrowth).toBeLessThan(
        PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD
      );
    });

    it("should monitor system performance over time", async () => {
      const testDuration = 3000; // 3 seconds

      // Start intensive processing
      const startTime = Date.now();
      const promises = [];

      while (Date.now() - startTime < testDuration) {
        const event: FarcasterEvent = {
          type: "MERGE_MESSAGE",
          id: Date.now(),
          mergeMessageBody: {
            message: {
              data: {
                fid: Math.floor(Math.random() * 1000) + 9000,
                type: "MESSAGE_TYPE_CAST_ADD",
                timestamp: Math.floor(Date.now() / 1000),
                castAddBody: {
                  text: `Continuous test cast ${Date.now()}`,
                  embeds: [],
                  mentions: [],
                  mentionsPositions: [],
                },
              },
              hash: `continuous-${Date.now()}`,
              hashScheme: "HASH_SCHEME_BLAKE3",
              signature: `continuous-sig-${Date.now()}`,
              signatureScheme: "SIGNATURE_SCHEME_ED25519",
              signer: `continuous-signer-${Date.now()}`,
            },
          },
        };

        const promise = processorWorker.processJob({ data: { event } } as any);
        promises.push(promise);

        // Small delay to prevent overwhelming
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Wait for all operations to complete
      await Promise.all(promises);

      // Get monitoring data
      const measurements = monitor.getMeasurements();
      expect(measurements.length).toBeGreaterThan(0);

      const currentStats = monitor.getCurrentStats();
      expect(currentStats.memory.heapUsed).toBeLessThan(
        PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MAX
      );

      console.log(`Processed ${promises.length} events in ${testDuration}ms`);
      console.log(
        `Final memory usage: ${currentStats.memory.heapUsed.toFixed(2)}MB`
      );
    });
  });

  describe("Performance Report Generation", () => {
    it("should generate comprehensive performance report", () => {
      const report = generatePerformanceReport();
      expect(typeof report).toBe("string");
      expect(report).toContain("Farcaster Indexer Performance Report");
      expect(report).toContain("System Monitor Report");

      console.log(report);
    });

    it("should validate performance against thresholds", () => {
      const validation = validatePerformance();
      expect(validation).toHaveProperty("passed");
      expect(validation).toHaveProperty("failures");
      expect(validation).toHaveProperty("warnings");

      expect(Array.isArray(validation.failures)).toBe(true);
      expect(Array.isArray(validation.warnings)).toBe(true);

      if (!validation.passed) {
        console.warn("Performance validation failed:", validation.failures);
      }
    });
  });
});
