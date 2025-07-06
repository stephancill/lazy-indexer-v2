import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type {
  FarcasterHttpEvent,
  FarcasterHttpMessage,
} from "@farcaster-indexer/shared";
import { MessageType } from "@farcaster/core";

// Mock the message parser utilities
const mockParseMessageFromJson = vi.fn();
const mockConvertFarcasterTime = vi.fn();
const mockCreateCastRecord = vi.fn();
const mockCreateReactionRecord = vi.fn();
const mockCreateUserDataRecord = vi.fn();

// Mock all external dependencies
const mockDb = {
  insert: vi.fn(),
  delete: vi.fn(),
  execute: vi.fn().mockResolvedValue(undefined),
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

const mockBatchInsert = vi.fn();
const mockEq = vi.fn((field, value) => ({ field, value }));
const mockSql = vi.fn();

vi.mock("@farcaster-indexer/shared", () => ({
  db: mockDb,
  schema: mockSchema,
  batchInsert: mockBatchInsert,
  parseMessageFromJson: mockParseMessageFromJson,
  convertFarcasterTime: mockConvertFarcasterTime,
  createCastRecord: mockCreateCastRecord,
  createReactionRecord: mockCreateReactionRecord,
  createLinkRecord: vi.fn(),
  createVerificationRecord: vi.fn(),
  createUserDataRecord: mockCreateUserDataRecord,
  createOnChainEventRecord: vi.fn(),
  convertMessageHash: vi.fn((hash) => `0x${hash.toString()}`),
}));

vi.mock("drizzle-orm", () => ({
  eq: mockEq,
  sql: mockSql,
}));

describe("ProcessorWorker", () => {
  let ProcessorWorker: any;
  let worker: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock return values
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        onConflictDoUpdate: vi.fn(() => ({
          target: {},
          set: {},
        })),
      }),
    });

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    // Mock message parser utilities
    mockParseMessageFromJson.mockImplementation((httpMessage) => ({
      data: httpMessage.data,
      hash: new Uint8Array([0x89, 0xf4, 0xde, 0x36]),
    }));

    mockConvertFarcasterTime.mockImplementation(
      (timestamp) => new Date(timestamp * 1000)
    );

    mockCreateCastRecord.mockImplementation(() => ({
      hash: "0x89f4de362897aa0023df86c257860d3a6e73eba9",
      fid: 1689,
      text: "just setting up my farcaster",
      parentHash: null,
      parentFid: null,
      parentUrl: null,
      timestamp: new Date(53200214 * 1000),
      embeds: "[]",
    }));

    mockCreateReactionRecord.mockImplementation(() => ({
      hash: "0xe7acbc61aea43485be36abd980b672a7c9d71f48",
      fid: 1689,
      type: "like",
      targetHash: "0xf384e3556c20a3b7b10371140ce81894a110261a",
      timestamp: new Date(127590822 * 1000),
    }));

    mockCreateUserDataRecord.mockImplementation(() => ({
      hash: "0xf704a870b4fec78f9bafce8445cf53cf7448f99b",
      fid: 1689,
      type: "username",
      value: "stephancill",
      timestamp: new Date(69403502 * 1000),
    }));

    // Capture a copy of the data array when batchInsert is called
    // since ProcessorWorker clears the array after insertion
    mockBatchInsert.mockImplementation(async (table, data, options) => {
      // Store a copy of the arguments to prevent mutation issues
      const callArgs = [table, [...data], options];
      // Replace the call arguments with our copy
      const callIndex = mockBatchInsert.mock.calls.length - 1;
      mockBatchInsert.mock.calls[callIndex] = callArgs;
      return undefined;
    });

    // Import the ProcessorWorker after mocking
    const module = await import("./processor.js");
    ProcessorWorker = module.ProcessorWorker;
    worker = new ProcessorWorker();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("processJob", () => {
    it("should process MERGE_MESSAGE events with real cast data", async () => {
      const event: FarcasterHttpEvent = {
        type: "HUB_EVENT_TYPE_MERGE_MESSAGE",
        id: 140338593792,
        mergeMessageBody: {
          message: {
            data: {
              type: "MESSAGE_TYPE_CAST_ADD",
              fid: 397286,
              timestamp: 142041602,
              network: "FARCASTER_NETWORK_MAINNET",
              castAddBody: {
                mentions: [],
                parentUrl: "https://warpcast.com/~/channel/xkolmonitor",
                text: "Paul Vigna:\n- [07-03 07:44] Susan B. Anthony美元价值探讨",
                embeds: [
                  {
                    url: "https://t.me/xkolmonitor",
                  },
                ],
                mentionsPositions: [],
              },
            },
            hash: "0x85590f8e385d0a0a99deb552c9f95a049acee012",
            hashScheme: "HASH_SCHEME_BLAKE3",
            signature:
              "if5WshTD9aS8AO/xR4u5hMdznfsy9smd1D8lWuoN7ddHHmFWYVx3GgNfzF95rF83URotkWwZKv1UYhNEiHKyCA==",
            signatureScheme: "SIGNATURE_SCHEME_ED25519",
            signer:
              "0xefbb0795c6b6c4b98d82b3175ba4caef5d655046db09a8c27dd9ba915ae2e450",
          },
          deletedMessages: [],
        },
      };

      // Mock the parsed message for this specific test
      mockParseMessageFromJson.mockReturnValueOnce({
        data: {
          type: MessageType.CAST_ADD,
          fid: 397286,
          timestamp: 142041602,
          castAddBody: event.mergeMessageBody?.message.data.castAddBody,
        },
        hash: new Uint8Array([0x85, 0x59, 0x0f, 0x8e]),
      });

      mockCreateCastRecord.mockReturnValueOnce({
        hash: "0x85590f8e385d0a0a99deb552c9f95a049acee012",
        fid: 397286,
        text: "Paul Vigna:\n- [07-03 07:44] Susan B. Anthony美元价值探讨",
        parentUrl: "https://warpcast.com/~/channel/xkolmonitor",
        parentHash: null,
        parentFid: null,
        timestamp: new Date(142041602 * 1000),
        embeds: JSON.stringify([{ url: "https://t.me/xkolmonitor" }]),
      });

      const job = { data: { event } };
      await worker.processJob(job);

      // Manually flush to test batch behavior
      await worker.flushAllBatches();

      // Check that mockBatchInsert was called
      expect(mockBatchInsert).toHaveBeenCalled();

      expect(mockBatchInsert).toHaveBeenCalledWith(
        mockSchema.casts,
        expect.arrayContaining([
          expect.objectContaining({
            fid: 397286,
            text: "Paul Vigna:\n- [07-03 07:44] Susan B. Anthony美元价值探讨",
            parentUrl: "https://warpcast.com/~/channel/xkolmonitor",
            parentHash: null,
            parentFid: null,
            hash: expect.any(String),
            timestamp: expect.any(Date),
            embeds: expect.any(String),
          }),
        ]),
        expect.objectContaining({
          batchSize: 100,
          onConflictDoNothing: true,
        })
      );
    });

    it("should process MERGE_MESSAGE events with real reaction data", async () => {
      const event: FarcasterHttpEvent = {
        type: "HUB_EVENT_TYPE_MERGE_MESSAGE",
        id: 140338610176,
        mergeMessageBody: {
          message: {
            data: {
              type: "MESSAGE_TYPE_REACTION_ADD",
              fid: 543139,
              timestamp: 142041603,
              network: "FARCASTER_NETWORK_MAINNET",
              reactionBody: {
                type: "REACTION_TYPE_LIKE",
                targetCastId: {
                  fid: 963075,
                  hash: "0x33a09c8021b6977548d5bca82b7caa92916aaa8a",
                },
              },
            },
            hash: "0x10ae42904053cebc034331e048676d756c39cd83",
            hashScheme: "HASH_SCHEME_BLAKE3",
            signature:
              "aYpRxc4soXoM88hiumPf1RYhB1/UAZJ//wWd8iDtWaphwOPeysNzJnKUcPmc5mtSESOcIXNsoQefLNC8DI/5Bg==",
            signatureScheme: "SIGNATURE_SCHEME_ED25519",
            signer:
              "0x03a4558728b05c14abea40d160a178dff0c81914ec36c7eae1458cf983ece3f4",
          },
          deletedMessages: [],
        },
      };

      // Mock the parsed message for this specific test
      mockParseMessageFromJson.mockReturnValueOnce({
        data: {
          type: MessageType.REACTION_ADD,
          fid: 543139,
          timestamp: 142041603,
          reactionBody: event.mergeMessageBody?.message.data.reactionBody,
        },
        hash: new Uint8Array([0x10, 0xae, 0x42, 0x90]),
      });

      mockCreateReactionRecord.mockReturnValueOnce({
        hash: "0x10ae42904053cebc034331e048676d756c39cd83",
        fid: 543139,
        type: "like",
        targetHash: "0x33a09c8021b6977548d5bca82b7caa92916aaa8a",
        timestamp: new Date(142041603 * 1000),
      });

      const job = { data: { event } };
      await worker.processJob(job);

      // Manually flush to test batch behavior
      await worker.flushAllBatches();

      // Check that mockBatchInsert was called
      expect(mockBatchInsert).toHaveBeenCalled();

      expect(mockBatchInsert).toHaveBeenCalledWith(
        mockSchema.reactions,
        expect.arrayContaining([
          expect.objectContaining({
            fid: 543139,
            type: "like",
            hash: expect.any(String),
            targetHash: expect.any(String),
            timestamp: expect.any(Date),
          }),
        ]),
        expect.objectContaining({
          batchSize: 100,
          onConflictDoNothing: true,
        })
      );
    });

    it("should process MERGE_MESSAGE events with real user data", async () => {
      const event: FarcasterHttpEvent = {
        type: "HUB_EVENT_TYPE_MERGE_MESSAGE",
        id: 140339855363,
        mergeMessageBody: {
          message: {
            data: {
              type: "MESSAGE_TYPE_USER_DATA_ADD",
              fid: 1113398,
              timestamp: 142041680,
              network: "FARCASTER_NETWORK_MAINNET",
              userDataBody: {
                type: "USER_DATA_TYPE_PFP",
                value:
                  "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/95e044eb-c3e1-47ca-ae1a-6cfce9f2ce00/original",
              },
            },
            hash: "0xe3909436e7db929eef6532568c7152afd20996b1",
            hashScheme: "HASH_SCHEME_BLAKE3",
            signature:
              "7+W/syg9o8jzqcds3rDzaNFqVocfBrBycUURQ7INCXRwcfQxl1LXyYpHetN0zoZPqVgDqBLIAY/6l+lOENWcBA==",
            signatureScheme: "SIGNATURE_SCHEME_ED25519",
            signer:
              "0xe8cf26d16e8ef540877b6eebcb53378455f22edf35062a25d12b35e4b7e66251",
          },
          deletedMessages: [
            {
              data: {
                type: "MESSAGE_TYPE_USER_DATA_ADD",
                fid: 1113398,
                timestamp: 142041052,
                network: "FARCASTER_NETWORK_MAINNET",
                userDataBody: {
                  type: "USER_DATA_TYPE_PFP",
                  value:
                    "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/95e044eb-c3e1-47ca-ae1a-6cfce9f2ce00/original",
                },
              },
              hash: "0xafaac1b76378109898bb2de3ac55e26c23e2fa2e",
              hashScheme: "HASH_SCHEME_BLAKE3",
              signature:
                "M1Iz4hKXga/YtmfMGB1RLaU2I/KVlk29T5Vb2hmMD55aTTfSgF18UK2okmJ725RpIlQg8uYMymnAGh6E70sGBw==",
              signatureScheme: "SIGNATURE_SCHEME_ED25519",
              signer:
                "0xe8cf26d16e8ef540877b6eebcb53378455f22edf35062a25d12b35e4b7e66251",
            },
          ],
        },
      };

      // Mock the parsed message for this specific test
      mockParseMessageFromJson.mockReturnValueOnce({
        data: {
          type: MessageType.USER_DATA_ADD,
          fid: 1113398,
          timestamp: 142041680,
          userDataBody: event.mergeMessageBody?.message.data.userDataBody,
        },
        hash: new Uint8Array([0xe3, 0x90, 0x94, 0x36]),
      });

      mockCreateUserDataRecord.mockReturnValueOnce({
        hash: "0xe3909436e7db929eef6532568c7152afd20996b1",
        fid: 1113398,
        type: "pfp",
        value:
          "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/95e044eb-c3e1-47ca-ae1a-6cfce9f2ce00/original",
        timestamp: new Date(142041680 * 1000),
      });

      const job = { data: { event } };
      await worker.processJob(job);

      // Manually flush to test batch behavior
      await worker.flushAllBatches();

      // Check that mockBatchInsert was called for user data
      expect(mockBatchInsert).toHaveBeenCalled();

      expect(mockBatchInsert).toHaveBeenCalledWith(
        mockSchema.userData,
        expect.arrayContaining([
          expect.objectContaining({
            fid: 1113398,
            type: "pfp",
            value:
              "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/95e044eb-c3e1-47ca-ae1a-6cfce9f2ce00/original",
            hash: expect.any(String),
            timestamp: expect.any(Date),
          }),
        ]),
        expect.objectContaining({
          batchSize: 100,
          onConflictDoNothing: true,
        })
      );

      // Also verify that users materialized view refresh was attempted
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it("should handle processing errors", async () => {
      const event: FarcasterHttpEvent = {
        type: "HUB_EVENT_TYPE_MERGE_MESSAGE",
        id: 1001,
        mergeMessageBody: {
          message: {
            data: {
              type: "MESSAGE_TYPE_CAST_ADD",
              fid: 1689,
              timestamp: 53200214,
              network: "FARCASTER_NETWORK_MAINNET",
              castAddBody: {
                mentions: [],
                text: "just setting up my farcaster",
                embeds: [],
                mentionsPositions: [],
              },
            },
            hash: "0x89f4de362897aa0023df86c257860d3a6e73eba9",
            hashScheme: "HASH_SCHEME_BLAKE3",
            signature:
              "YfOHb38IQCsV5Bb87skeKIY7LB2ukTVQfShITA8s1thumo1TOokv028VBZYBtq448aP1bnDQ939NG6GbkRMIDw==",
            signatureScheme: "SIGNATURE_SCHEME_ED25519",
            signer:
              "0xa5f666cac97ae9f09f78cfaaa624ea2a1f03f042aa87c955d0113275e54e9cfe",
          },
          deletedMessages: [],
        },
      };

      // Mock the parsed message for this specific test
      mockParseMessageFromJson.mockReturnValueOnce({
        data: {
          type: MessageType.CAST_ADD,
          fid: 1689,
          timestamp: 53200214,
          castAddBody: event.mergeMessageBody?.message.data.castAddBody,
        },
        hash: new Uint8Array([0x89, 0xf4, 0xde, 0x36]),
      });

      // Set up the mock to reject on the next call
      mockBatchInsert.mockRejectedValueOnce(new Error("Database error"));

      const job = { data: { event } };

      // Process the job (this should work)
      await worker.processJob(job);

      // Now flush should log the error but not throw
      await worker.flushAllBatches();

      // Verify that the error was handled (mockBatchInsert was called and rejected)
      expect(mockBatchInsert).toHaveBeenCalled();
    });
  });

  describe("message parsing integration", () => {
    it("should use message parser utilities correctly", async () => {
      const httpMessage = {
        data: {
          type: "MESSAGE_TYPE_CAST_ADD",
          fid: 1689,
          timestamp: 53200214,
          network: "FARCASTER_NETWORK_MAINNET",
          castAddBody: {
            mentions: [],
            text: "just setting up my farcaster",
            embeds: [],
            mentionsPositions: [],
          },
        },
        hash: "0x89f4de362897aa0023df86c257860d3a6e73eba9",
        hashScheme: "HASH_SCHEME_BLAKE3",
        signature:
          "YfOHb38IQCsV5Bb87skeKIY7LB2ukTVQfShITA8s1thumo1TOokv028VBZYBtq448aP1bnDQ939NG6GbkRMIDw==",
        signatureScheme: "SIGNATURE_SCHEME_ED25519",
        signer:
          "0xa5f666cac97ae9f09f78cfaaa624ea2a1f03f042aa87c955d0113275e54e9cfe",
      };

      // Mock the parsed message
      mockParseMessageFromJson.mockReturnValueOnce({
        data: {
          type: MessageType.CAST_ADD,
          fid: 1689,
          timestamp: 53200214,
          castAddBody: httpMessage.data.castAddBody,
        },
        hash: new Uint8Array([0x89, 0xf4, 0xde, 0x36]),
      });

      const event: FarcasterHttpEvent = {
        type: "HUB_EVENT_TYPE_MERGE_MESSAGE",
        id: 1001,
        mergeMessageBody: {
          message: httpMessage,
          deletedMessages: [],
        },
      };

      const job = { data: { event } };
      await worker.processJob(job);

      // Verify that the message parser utilities were called
      expect(mockParseMessageFromJson).toHaveBeenCalledWith(httpMessage);
      expect(mockCreateCastRecord).toHaveBeenCalled();
    });

    it("should handle different message types through factory functions", async () => {
      // Test that reaction messages are handled
      const reactionMessage = {
        data: {
          type: "MESSAGE_TYPE_REACTION_ADD",
          fid: 1689,
          timestamp: 127590822,
          network: "FARCASTER_NETWORK_MAINNET",
          reactionBody: {
            type: "REACTION_TYPE_LIKE" as const,
            targetCastId: {
              fid: 3,
              hash: "0xf384e3556c20a3b7b10371140ce81894a110261a",
            },
          },
        },
        hash: "0xe7acbc61aea43485be36abd980b672a7c9d71f48",
        hashScheme: "HASH_SCHEME_BLAKE3",
        signature: "test-signature",
        signatureScheme: "SIGNATURE_SCHEME_ED25519",
        signer:
          "0xa5f666cac97ae9f09f78cfaaa624ea2a1f03f042aa87c955d0113275e54e9cfe",
      };

      mockParseMessageFromJson.mockReturnValueOnce({
        data: {
          type: MessageType.REACTION_ADD,
          fid: 1689,
          timestamp: 127590822,
          reactionBody: reactionMessage.data.reactionBody,
        },
        hash: new Uint8Array([0xe7, 0xac, 0xbc, 0x61]),
      });

      const event: FarcasterHttpEvent = {
        type: "HUB_EVENT_TYPE_MERGE_MESSAGE",
        id: 1002,
        mergeMessageBody: {
          message: reactionMessage,
          deletedMessages: [],
        },
      };

      const job = { data: { event } };
      await worker.processJob(job);

      // Verify that the reaction parser was called
      expect(mockCreateReactionRecord).toHaveBeenCalled();
    });
  });
});
