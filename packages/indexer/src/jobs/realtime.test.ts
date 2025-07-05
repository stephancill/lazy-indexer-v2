import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type {
  FarcasterEvent,
  FarcasterMessage,
} from "@farcaster-indexer/shared";

// Mock all external dependencies
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockSchema = {
  targets: {
    fid: "fid",
    isRoot: "is_root",
  },
  syncState: {
    name: "name",
    lastEventId: "last_event_id",
  },
};

vi.mock("@farcaster-indexer/shared", () => ({
  db: mockDb,
  schema: mockSchema,
  HubClient: vi.fn(),
}));

const mockQueueFunctions = {
  isTargetInSet: vi.fn(),
  isClientTargetInSet: vi.fn(),
  addTargetToSet: vi.fn(),
  scheduleBackfillJob: vi.fn(),
  scheduleEventProcessing: vi.fn(),
  removeTargetFromSet: vi.fn(),
};

vi.mock("../queue.js", () => mockQueueFunctions);

describe("RealtimeWorker", () => {
  let worker: any;
  let mockHubClient: any;

  beforeEach(async () => {
    mockHubClient = {
      getEvents: vi.fn(),
    };

    // Setup mock return values
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    // Import the RealtimeWorker after mocking
    const { RealtimeWorker } = await import("./realtime.js");
    worker = new RealtimeWorker(mockHubClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("processJob", () => {
    it("should process realtime sync job with no events", async () => {
      mockHubClient.getEvents.mockResolvedValue({ events: [] });

      const job = {
        data: { lastEventId: 1000 },
      };

      await worker.processJob(job as any);

      expect(mockHubClient.getEvents).toHaveBeenCalledWith({
        fromEventId: 1000,
        pageSize: 100,
      });
    });

    it("should process realtime sync job with events", async () => {
      const mockEvents: FarcasterEvent[] = [
        {
          type: "MERGE_MESSAGE",
          id: 1001,
          mergeMessageBody: {
            message: {
              data: {
                fid: 123,
                type: "MESSAGE_TYPE_CAST_ADD",
                timestamp: 1234567890,
                castAddBody: {
                  text: "Test cast",
                  embeds: [],
                  mentions: [],
                  mentionsPositions: [],
                },
              },
              hash: "test-hash",
              hashScheme: "HASH_SCHEME_BLAKE3",
              signature: "test-signature",
              signatureScheme: "SIGNATURE_SCHEME_ED25519",
              signer: "test-signer",
            },
          },
        },
      ];

      mockHubClient.getEvents.mockResolvedValue({ events: mockEvents });
      mockQueueFunctions.isTargetInSet.mockResolvedValue(true);
      mockQueueFunctions.scheduleEventProcessing.mockResolvedValue(undefined);

      const job = {
        data: { lastEventId: 1000 },
      };

      await worker.processJob(job as any);

      expect(mockHubClient.getEvents).toHaveBeenCalledWith({
        fromEventId: 1000,
        pageSize: 100,
      });
      expect(mockQueueFunctions.scheduleEventProcessing).toHaveBeenCalledWith(
        mockEvents[0]
      );
    });

    it("should handle errors gracefully", async () => {
      mockHubClient.getEvents.mockRejectedValue(new Error("Hub error"));

      const job = {
        data: { lastEventId: 1000 },
      };

      await expect(worker.processJob(job as any)).rejects.toThrow("Hub error");
    });
  });

  describe("shouldProcessEvent", () => {
    it("should process MERGE_MESSAGE events from targets", async () => {
      const event: FarcasterEvent = {
        type: "MERGE_MESSAGE",
        id: 1001,
        mergeMessageBody: {
          message: {
            data: {
              fid: 123,
              type: "MESSAGE_TYPE_CAST_ADD",
              timestamp: 1234567890,
              castAddBody: {
                text: "Test cast",
                embeds: [],
                mentions: [],
                mentionsPositions: [],
              },
            },
            hash: "test-hash",
            hashScheme: "HASH_SCHEME_BLAKE3",
            signature: "test-signature",
            signatureScheme: "SIGNATURE_SCHEME_ED25519",
            signer: "test-signer",
          },
        },
      };

      mockQueueFunctions.isTargetInSet.mockResolvedValue(true);

      const result = await (worker as any).shouldProcessEvent(event);

      expect(result).toBe(true);
      expect(mockQueueFunctions.isTargetInSet).toHaveBeenCalledWith(123);
    });

    it("should process MERGE_MESSAGE events that are replies to targets", async () => {
      const event: FarcasterEvent = {
        type: "MERGE_MESSAGE",
        id: 1001,
        mergeMessageBody: {
          message: {
            data: {
              fid: 456,
              type: "MESSAGE_TYPE_CAST_ADD",
              timestamp: 1234567890,
              castAddBody: {
                text: "Test reply",
                embeds: [],
                mentions: [],
                mentionsPositions: [],
                parentCastId: {
                  fid: 123,
                  hash: "parent-hash",
                },
              },
            },
            hash: "test-hash",
            hashScheme: "HASH_SCHEME_BLAKE3",
            signature: "test-signature",
            signatureScheme: "SIGNATURE_SCHEME_ED25519",
            signer: "test-signer",
          },
        },
      };

      mockQueueFunctions.isTargetInSet.mockResolvedValueOnce(false); // Not from target
      mockQueueFunctions.isTargetInSet.mockResolvedValueOnce(true); // Reply to target

      const result = await (worker as any).shouldProcessEvent(event);

      expect(result).toBe(true);
      expect(mockQueueFunctions.isTargetInSet).toHaveBeenCalledWith(456); // Original FID
      expect(mockQueueFunctions.isTargetInSet).toHaveBeenCalledWith(123); // Parent FID
    });

    it("should process MERGE_MESSAGE events that are reactions to targets", async () => {
      const event: FarcasterEvent = {
        type: "MERGE_MESSAGE",
        id: 1001,
        mergeMessageBody: {
          message: {
            data: {
              fid: 456,
              type: "MESSAGE_TYPE_REACTION_ADD",
              timestamp: 1234567890,
              reactionBody: {
                type: "LIKE",
                targetCastId: {
                  fid: 123,
                  hash: "target-hash",
                },
              },
            },
            hash: "test-hash",
            hashScheme: "HASH_SCHEME_BLAKE3",
            signature: "test-signature",
            signatureScheme: "SIGNATURE_SCHEME_ED25519",
            signer: "test-signer",
          },
        },
      };

      mockQueueFunctions.isTargetInSet.mockResolvedValueOnce(false); // Not from target
      mockQueueFunctions.isTargetInSet.mockResolvedValueOnce(true); // Reaction to target

      const result = await (worker as any).shouldProcessEvent(event);

      expect(result).toBe(true);
      expect(mockQueueFunctions.isTargetInSet).toHaveBeenCalledWith(456); // Original FID
      expect(mockQueueFunctions.isTargetInSet).toHaveBeenCalledWith(123); // Target FID
    });

    it("should process MERGE_ON_CHAIN_EVENT events from monitored clients", async () => {
      const event: FarcasterEvent = {
        type: "MERGE_ON_CHAIN_EVENT",
        id: 1001,
        mergeOnChainEventBody: {
          onChainEvent: {
            type: "EVENT_TYPE_SIGNER_ADD",
            fid: 123,
            chainId: 10,
            blockNumber: 1000,
            blockHash: "block-hash",
            blockTimestamp: 1234567890,
            transactionHash: "tx-hash",
            logIndex: 1,
            signerEventBody: {
              key: "signer-key",
              keyType: 1,
              eventType: "ADD",
              metadata: "metadata",
              metadataType: 1,
            },
          },
        },
      };

      mockQueueFunctions.isClientTargetInSet.mockResolvedValue(true);

      const result = await (worker as any).shouldProcessEvent(event);

      expect(result).toBe(true);
      expect(mockQueueFunctions.isClientTargetInSet).toHaveBeenCalledWith(123);
    });

    it("should not process events from non-targets", async () => {
      const event: FarcasterEvent = {
        type: "MERGE_MESSAGE",
        id: 1001,
        mergeMessageBody: {
          message: {
            data: {
              fid: 456,
              type: "MESSAGE_TYPE_CAST_ADD",
              timestamp: 1234567890,
              castAddBody: {
                text: "Test cast",
                embeds: [],
                mentions: [],
                mentionsPositions: [],
              },
            },
            hash: "test-hash",
            hashScheme: "HASH_SCHEME_BLAKE3",
            signature: "test-signature",
            signatureScheme: "SIGNATURE_SCHEME_ED25519",
            signer: "test-signer",
          },
        },
      };

      mockQueueFunctions.isTargetInSet.mockResolvedValue(false);

      const result = await (worker as any).shouldProcessEvent(event);

      expect(result).toBe(false);
    });

    it("should handle unknown event types", async () => {
      const event: FarcasterEvent = {
        type: "UNKNOWN_EVENT" as any,
        id: 1001,
      };

      const result = await (worker as any).shouldProcessEvent(event);

      expect(result).toBe(false);
    });
  });

  describe("handleDynamicTargetExpansion", () => {
    it("should add new targets when root targets follow users", async () => {
      const event: FarcasterEvent = {
        type: "MERGE_MESSAGE",
        id: 1001,
        mergeMessageBody: {
          message: {
            data: {
              fid: 123,
              type: "MESSAGE_TYPE_LINK_ADD",
              timestamp: 1234567890,
              linkBody: {
                type: "follow",
                targetFid: 456,
              },
            },
            hash: "test-hash",
            hashScheme: "HASH_SCHEME_BLAKE3",
            signature: "test-signature",
            signatureScheme: "SIGNATURE_SCHEME_ED25519",
            signer: "test-signer",
          },
        },
      };

      // Mock root target query
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ fid: 123, isRoot: true }]),
          }),
        }),
      });

      // Mock target existence check
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await (worker as any).handleDynamicTargetExpansion(event);

      expect(mockDb.insert).toHaveBeenCalledWith(expect.anything());
      expect(mockQueueFunctions.addTargetToSet).toHaveBeenCalledWith(456);
      expect(mockQueueFunctions.scheduleBackfillJob).toHaveBeenCalledWith(
        456,
        false
      );
    });

    it("should add new root targets when monitored clients add signers", async () => {
      const event: FarcasterEvent = {
        type: "MERGE_ON_CHAIN_EVENT",
        id: 1001,
        mergeOnChainEventBody: {
          onChainEvent: {
            type: "EVENT_TYPE_SIGNER_ADD",
            fid: 789,
            chainId: 10,
            blockNumber: 1000,
            blockHash: "block-hash",
            blockTimestamp: 1234567890,
            transactionHash: "tx-hash",
            logIndex: 1,
            signerEventBody: {
              key: "signer-key",
              keyType: 1,
              eventType: "ADD",
              metadata: "metadata",
              metadataType: 1,
            },
          },
        },
      };

      mockQueueFunctions.isClientTargetInSet.mockResolvedValue(true);

      // Mock target existence check
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await (worker as any).handleDynamicTargetExpansion(event);

      expect(mockDb.insert).toHaveBeenCalledWith(expect.anything());
      expect(mockQueueFunctions.addTargetToSet).toHaveBeenCalledWith(789);
      expect(mockQueueFunctions.scheduleBackfillJob).toHaveBeenCalledWith(
        789,
        true
      );
    });
  });

  describe("getLastProcessedEventId", () => {
    it("should return last processed event ID from database", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ lastEventId: 1000 }]),
          }),
        }),
      });

      const result = await (worker as any).getLastProcessedEventId();

      expect(result).toBe(1000);
    });

    it("should return 0 if no last event ID found", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await (worker as any).getLastProcessedEventId();

      expect(result).toBe(0);
    });

    it("should handle database errors gracefully", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error("Database error")),
          }),
        }),
      });

      const result = await (worker as any).getLastProcessedEventId();

      expect(result).toBe(0);
    });
  });

  describe("updateLastProcessedEventId", () => {
    it("should update last processed event ID in database", async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await (worker as any).updateLastProcessedEventId(2000);

      expect(mockDb.insert).toHaveBeenCalledWith(expect.anything());
    });

    it("should handle database errors gracefully", async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi
            .fn()
            .mockRejectedValue(new Error("Database error")),
        }),
      });

      // Should not throw
      await (worker as any).updateLastProcessedEventId(2000);
    });
  });
});
