import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type {
  FarcasterEvent,
  FarcasterMessage,
} from "@farcaster-indexer/shared";

// Mock all external dependencies
const mockDb = {
  insert: vi.fn(),
  delete: vi.fn(),
};

const mockSchema = {
  casts: { hash: "hash" },
  reactions: { hash: "hash" },
  links: { hash: "hash" },
  verifications: { hash: "hash" },
  userData: { hash: "hash" },
  users: { fid: "fid" },
  onChainEvents: {},
};

vi.mock("@farcaster-indexer/shared", () => ({
  db: mockDb,
  schema: mockSchema,
}));

describe("ProcessorWorker", () => {
  let worker: any;

  beforeEach(async () => {
    // Setup mock return values
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    });

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    // Import the ProcessorWorker after mocking
    const { ProcessorWorker } = await import("./processor.js");
    worker = new ProcessorWorker();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("processJob", () => {
    it("should process MERGE_MESSAGE events", async () => {
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

      const job = {
        data: { event },
      };

      await worker.processJob(job as any);

      expect(mockDb.insert).toHaveBeenCalledWith(expect.anything());
    });

    it("should process MERGE_ON_CHAIN_EVENT events", async () => {
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

      const job = {
        data: { event },
      };

      await worker.processJob(job as any);

      expect(mockDb.insert).toHaveBeenCalledWith(expect.anything());
    });

    it("should process PRUNE_MESSAGE events", async () => {
      const event: FarcasterEvent = {
        type: "PRUNE_MESSAGE",
        id: 1001,
        pruneMessageBody: {
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

      const job = {
        data: { event },
      };

      await worker.processJob(job as any);

      expect(mockDb.delete).toHaveBeenCalledWith(expect.anything());
    });

    it("should handle unknown event types gracefully", async () => {
      const event: FarcasterEvent = {
        type: "UNKNOWN_EVENT" as any,
        id: 1001,
      };

      const job = {
        data: { event },
      };

      await worker.processJob(job as any);

      // Should not throw and should log unknown event type
    });

    it("should handle processing errors", async () => {
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

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi
            .fn()
            .mockRejectedValue(new Error("Database error")),
        }),
      });

      const job = {
        data: { event },
      };

      await expect(worker.processJob(job as any)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("processCastAdd", () => {
    it("should process cast add message", async () => {
      const message: FarcasterMessage = {
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
      };

      await (worker as any).processCastAdd(message);

      expect(mockDb.insert).toHaveBeenCalledWith(expect.anything());
      expect(mockDb.insert().values).toHaveBeenCalledWith({
        hash: "test-hash",
        fid: 123,
        text: "Test cast",
        parentHash: null,
        parentFid: null,
        parentUrl: null,
        timestamp: new Date(1234567890000),
        embeds: "[]",
      });
    });

    it("should process cast add message with parent", async () => {
      const message: FarcasterMessage = {
        data: {
          fid: 123,
          type: "MESSAGE_TYPE_CAST_ADD",
          timestamp: 1234567890,
          castAddBody: {
            text: "Test reply",
            embeds: [],
            mentions: [],
            mentionsPositions: [],
            parentCastId: {
              fid: 456,
              hash: "parent-hash",
            },
          },
        },
        hash: "test-hash",
        hashScheme: "HASH_SCHEME_BLAKE3",
        signature: "test-signature",
        signatureScheme: "SIGNATURE_SCHEME_ED25519",
        signer: "test-signer",
      };

      await (worker as any).processCastAdd(message);

      expect(mockDb.insert().values).toHaveBeenCalledWith({
        hash: "test-hash",
        fid: 123,
        text: "Test reply",
        parentHash: "parent-hash",
        parentFid: 456,
        parentUrl: null,
        timestamp: new Date(1234567890000),
        embeds: "[]",
      });
    });
  });

  describe("processReactionAdd", () => {
    it("should process reaction add message", async () => {
      const message: FarcasterMessage = {
        data: {
          fid: 123,
          type: "MESSAGE_TYPE_REACTION_ADD",
          timestamp: 1234567890,
          reactionBody: {
            type: "LIKE",
            targetCastId: {
              fid: 456,
              hash: "target-hash",
            },
          },
        },
        hash: "test-hash",
        hashScheme: "HASH_SCHEME_BLAKE3",
        signature: "test-signature",
        signatureScheme: "SIGNATURE_SCHEME_ED25519",
        signer: "test-signer",
      };

      await (worker as any).processReactionAdd(message);

      expect(mockDb.insert().values).toHaveBeenCalledWith({
        hash: "test-hash",
        fid: 123,
        type: "like",
        targetHash: "target-hash",
        timestamp: new Date(1234567890000),
      });
    });

    it("should process recast message", async () => {
      const message: FarcasterMessage = {
        data: {
          fid: 123,
          type: "MESSAGE_TYPE_REACTION_ADD",
          timestamp: 1234567890,
          reactionBody: {
            type: "RECAST",
            targetCastId: {
              fid: 456,
              hash: "target-hash",
            },
          },
        },
        hash: "test-hash",
        hashScheme: "HASH_SCHEME_BLAKE3",
        signature: "test-signature",
        signatureScheme: "SIGNATURE_SCHEME_ED25519",
        signer: "test-signer",
      };

      await (worker as any).processReactionAdd(message);

      expect(mockDb.insert().values).toHaveBeenCalledWith({
        hash: "test-hash",
        fid: 123,
        type: "recast",
        targetHash: "target-hash",
        timestamp: new Date(1234567890000),
      });
    });
  });

  describe("processLinkAdd", () => {
    it("should process link add message", async () => {
      const message: FarcasterMessage = {
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
      };

      await (worker as any).processLinkAdd(message);

      expect(mockDb.insert().values).toHaveBeenCalledWith({
        hash: "test-hash",
        fid: 123,
        targetFid: 456,
        type: "follow",
        timestamp: new Date(1234567890000),
      });
    });
  });

  describe("processVerificationAdd", () => {
    it("should process verification add message", async () => {
      const message: FarcasterMessage = {
        data: {
          fid: 123,
          type: "MESSAGE_TYPE_VERIFICATION_ADD_ETH_ADDRESS",
          timestamp: 1234567890,
          verificationAddEthAddressBody: {
            address: "0x1234567890123456789012345678901234567890",
            ethSignature: "eth-signature",
            blockHash: "block-hash",
          },
        },
        hash: "test-hash",
        hashScheme: "HASH_SCHEME_BLAKE3",
        signature: "test-signature",
        signatureScheme: "SIGNATURE_SCHEME_ED25519",
        signer: "test-signer",
      };

      await (worker as any).processVerificationAdd(message);

      expect(mockDb.insert().values).toHaveBeenCalledWith({
        hash: "test-hash",
        fid: 123,
        address: "0x1234567890123456789012345678901234567890",
        protocol: "ethereum",
        timestamp: new Date(1234567890000),
      });
    });
  });

  describe("processUserDataAdd", () => {
    it("should process user data add message", async () => {
      const message: FarcasterMessage = {
        data: {
          fid: 123,
          type: "MESSAGE_TYPE_USER_DATA_ADD",
          timestamp: 1234567890,
          userDataBody: {
            type: "PFP",
            value: "https://example.com/pfp.jpg",
          },
        },
        hash: "test-hash",
        hashScheme: "HASH_SCHEME_BLAKE3",
        signature: "test-signature",
        signatureScheme: "SIGNATURE_SCHEME_ED25519",
        signer: "test-signer",
      };

      await (worker as any).processUserDataAdd(message);

      expect(mockDb.insert).toHaveBeenCalledTimes(2); // userData + user profile
    });

    it("should update user profile for display name", async () => {
      const message: FarcasterMessage = {
        data: {
          fid: 123,
          type: "MESSAGE_TYPE_USER_DATA_ADD",
          timestamp: 1234567890,
          userDataBody: {
            type: "DISPLAY",
            value: "John Doe",
          },
        },
        hash: "test-hash",
        hashScheme: "HASH_SCHEME_BLAKE3",
        signature: "test-signature",
        signatureScheme: "SIGNATURE_SCHEME_ED25519",
        signer: "test-signer",
      };

      await (worker as any).processUserDataAdd(message);

      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      // Second call should be for user profile update
      expect(mockDb.insert).toHaveBeenLastCalledWith(expect.anything());
    });
  });

  describe("removeMessage", () => {
    it("should remove cast message", async () => {
      const message: FarcasterMessage = {
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
      };

      await (worker as any).removeMessage(message);

      expect(mockDb.delete).toHaveBeenCalledWith(expect.anything());
    });

    it("should remove reaction message", async () => {
      const message: FarcasterMessage = {
        data: {
          fid: 123,
          type: "MESSAGE_TYPE_REACTION_ADD",
          timestamp: 1234567890,
          reactionBody: {
            type: "LIKE",
            targetCastId: {
              fid: 456,
              hash: "target-hash",
            },
          },
        },
        hash: "test-hash",
        hashScheme: "HASH_SCHEME_BLAKE3",
        signature: "test-signature",
        signatureScheme: "SIGNATURE_SCHEME_ED25519",
        signer: "test-signer",
      };

      await (worker as any).removeMessage(message);

      expect(mockDb.delete).toHaveBeenCalledWith(expect.anything());
    });

    it("should handle unknown message types gracefully", async () => {
      const message: FarcasterMessage = {
        data: {
          fid: 123,
          type: "UNKNOWN_MESSAGE_TYPE" as any,
          timestamp: 1234567890,
        },
        hash: "test-hash",
        hashScheme: "HASH_SCHEME_BLAKE3",
        signature: "test-signature",
        signatureScheme: "SIGNATURE_SCHEME_ED25519",
        signer: "test-signer",
      };

      await (worker as any).removeMessage(message);

      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });
});
