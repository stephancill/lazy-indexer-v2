import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type {
  FarcasterHttpEvent,
  FarcasterHttpMessage,
} from "@farcaster-indexer/shared";
import {
  Message,
  MessageType,
  ReactionType,
  UserDataType,
  fromFarcasterTime,
} from "@farcaster/core";
import { bytesToHex } from "viem";

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

const mockBatchInsert = vi.fn();
const mockEq = vi.fn((field, value) => ({ field, value }));

vi.mock("@farcaster-indexer/shared", () => ({
  db: mockDb,
  schema: mockSchema,
  batchInsert: mockBatchInsert,
}));

vi.mock("drizzle-orm", () => ({
  eq: mockEq,
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

      const job = { data: { event } };
      await worker.processJob(job);

      // Manually flush to test batch behavior
      await worker.flushAllBatches();

      // Check that mockBatchInsert was called
      expect(mockBatchInsert).toHaveBeenCalled();
      const expectedTimestamp = fromFarcasterTime(142041602)._unsafeUnwrap();

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
            timestamp: new Date(expectedTimestamp),
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

      const job = { data: { event } };
      await worker.processJob(job);

      // Manually flush to test batch behavior
      await worker.flushAllBatches();

      // Check that mockBatchInsert was called
      expect(mockBatchInsert).toHaveBeenCalled();
      const expectedTimestamp = fromFarcasterTime(142041603)._unsafeUnwrap();

      expect(mockBatchInsert).toHaveBeenCalledWith(
        mockSchema.reactions,
        expect.arrayContaining([
          expect.objectContaining({
            fid: 543139,
            type: "like",
            hash: expect.any(String),
            targetHash: expect.any(String),
            timestamp: new Date(expectedTimestamp),
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

      const job = { data: { event } };
      await worker.processJob(job);

      // Manually flush to test batch behavior
      await worker.flushAllBatches();

      // Check that mockBatchInsert was called for user data
      expect(mockBatchInsert).toHaveBeenCalled();
      const expectedTimestamp = fromFarcasterTime(142041680)._unsafeUnwrap();

      expect(mockBatchInsert).toHaveBeenCalledWith(
        mockSchema.userData,
        expect.arrayContaining([
          expect.objectContaining({
            fid: 1113398,
            type: "pfp",
            value:
              "https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/95e044eb-c3e1-47ca-ae1a-6cfce9f2ce00/original",
            hash: expect.any(String),
            timestamp: new Date(expectedTimestamp),
          }),
        ]),
        expect.objectContaining({
          batchSize: 100,
          onConflictDoNothing: true,
        })
      );

      // Also verify that user profile update was attempted
      expect(mockDb.insert).toHaveBeenCalledWith(mockSchema.users);
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

  describe("addCastToBatch", () => {
    it("should add cast to batch with correct data format", async () => {
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

      const parsedMessage = Message.fromJSON(httpMessage);
      await (worker as any).addCastToBatch(parsedMessage);

      // Trigger batch flush
      await (worker as any).flushAllBatches();

      // Check that mockBatchInsert was called
      expect(mockBatchInsert).toHaveBeenCalled();
      const expectedTimestamp = fromFarcasterTime(53200214)._unsafeUnwrap();

      expect(mockBatchInsert).toHaveBeenCalledWith(
        mockSchema.casts,
        expect.arrayContaining([
          expect.objectContaining({
            fid: 1689,
            text: "just setting up my farcaster",
            parentHash: null,
            parentFid: null,
            parentUrl: null,
            hash: expect.any(String),
            timestamp: new Date(expectedTimestamp),
            embeds: "[]",
          }),
        ]),
        expect.objectContaining({
          batchSize: 100,
          onConflictDoNothing: true,
        })
      );
    });
  });

  describe("addReactionToBatch", () => {
    it("should add reaction to batch with human-readable type", async () => {
      const httpMessage = {
        data: {
          type: "MESSAGE_TYPE_REACTION_ADD",
          fid: 1689,
          timestamp: 127590822,
          network: "FARCASTER_NETWORK_MAINNET",
          reactionBody: {
            type: "REACTION_TYPE_LIKE",
            targetCastId: {
              fid: 3,
              hash: "0xf384e3556c20a3b7b10371140ce81894a110261a",
            },
          },
        },
        hash: "0xe7acbc61aea43485be36abd980b672a7c9d71f48",
        hashScheme: "HASH_SCHEME_BLAKE3",
        signature:
          "RxmSqczCOyQAIV0PlPV0K5uTT66HxUs8POIRiCqIiM4IbXvoDrVk5rBqR8P9Zl+BPYAkxrZqRdAtq2+mmGFzCQ==",
        signatureScheme: "SIGNATURE_SCHEME_ED25519",
        signer:
          "0xa5f666cac97ae9f09f78cfaaa624ea2a1f03f042aa87c955d0113275e54e9cfe",
      };

      const parsedMessage = Message.fromJSON(httpMessage);
      await (worker as any).addReactionToBatch(parsedMessage);

      // Trigger batch flush
      await (worker as any).flushAllBatches();

      // Check that mockBatchInsert was called
      expect(mockBatchInsert).toHaveBeenCalled();
      const expectedTimestamp = fromFarcasterTime(127590822)._unsafeUnwrap();

      expect(mockBatchInsert).toHaveBeenCalledWith(
        mockSchema.reactions,
        expect.arrayContaining([
          expect.objectContaining({
            fid: 1689,
            type: "like",
            hash: expect.any(String),
            targetHash: expect.any(String),
            timestamp: new Date(expectedTimestamp),
          }),
        ]),
        expect.objectContaining({
          batchSize: 100,
          onConflictDoNothing: true,
        })
      );
    });

    it("should handle recast type correctly", async () => {
      const httpMessage = {
        data: {
          type: "MESSAGE_TYPE_REACTION_ADD",
          fid: 1689,
          timestamp: 127590822,
          network: "FARCASTER_NETWORK_MAINNET",
          reactionBody: {
            type: "REACTION_TYPE_RECAST",
            targetCastId: {
              fid: 3,
              hash: "0xf384e3556c20a3b7b10371140ce81894a110261a",
            },
          },
        },
        hash: "0xe7acbc61aea43485be36abd980b672a7c9d71f48",
        hashScheme: "HASH_SCHEME_BLAKE3",
        signature:
          "RxmSqczCOyQAIV0PlPV0K5uTT66HxUs8POIRiCqIiM4IbXvoDrVk5rBqR8P9Zl+BPYAkxrZqRdAtq2+mmGFzCQ==",
        signatureScheme: "SIGNATURE_SCHEME_ED25519",
        signer:
          "0xa5f666cac97ae9f09f78cfaaa624ea2a1f03f042aa87c955d0113275e54e9cfe",
      };

      const parsedMessage = Message.fromJSON(httpMessage);
      await (worker as any).addReactionToBatch(parsedMessage);

      // Trigger batch flush
      await (worker as any).flushAllBatches();

      // Check that mockBatchInsert was called
      expect(mockBatchInsert).toHaveBeenCalled();
      const expectedTimestamp = fromFarcasterTime(127590822)._unsafeUnwrap();

      expect(mockBatchInsert).toHaveBeenCalledWith(
        mockSchema.reactions,
        expect.arrayContaining([
          expect.objectContaining({
            type: "recast",
            timestamp: new Date(expectedTimestamp),
          }),
        ]),
        expect.objectContaining({
          batchSize: 100,
          onConflictDoNothing: true,
        })
      );
    });
  });

  describe("addUserDataToBatch", () => {
    it("should add user data to batch with human-readable type", async () => {
      const httpMessage = {
        data: {
          type: "MESSAGE_TYPE_USER_DATA_ADD",
          fid: 1689,
          timestamp: 69403502,
          network: "FARCASTER_NETWORK_MAINNET",
          userDataBody: {
            type: "USER_DATA_TYPE_USERNAME",
            value: "stephancill",
          },
        },
        hash: "0xf704a870b4fec78f9bafce8445cf53cf7448f99b",
        hashScheme: "HASH_SCHEME_BLAKE3",
        signature:
          "SERRxExYL/mWA0oxbq7WYda4R73xiBLmfW7HOU5OYjXQXte3pUXbmsdUw6HjMTpoqIFRP8oKeLnVTNPd/BiMBA==",
        signatureScheme: "SIGNATURE_SCHEME_ED25519",
        signer:
          "0xa5f666cac97ae9f09f78cfaaa624ea2a1f03f042aa87c955d0113275e54e9cfe",
      };

      const parsedMessage = Message.fromJSON(httpMessage);
      await (worker as any).addUserDataToBatch(parsedMessage);

      // Trigger batch flush
      await (worker as any).flushAllBatches();

      // Check that mockBatchInsert was called
      expect(mockBatchInsert).toHaveBeenCalled();
      const expectedTimestamp = fromFarcasterTime(69403502)._unsafeUnwrap();

      expect(mockBatchInsert).toHaveBeenCalledWith(
        mockSchema.userData,
        expect.arrayContaining([
          expect.objectContaining({
            fid: 1689,
            type: "username",
            value: "stephancill",
            hash: expect.any(String),
            timestamp: new Date(expectedTimestamp),
          }),
        ]),
        expect.objectContaining({
          batchSize: 100,
          onConflictDoNothing: true,
        })
      );
    });

    it("should handle display name correctly", async () => {
      const httpMessage = {
        data: {
          type: "MESSAGE_TYPE_USER_DATA_ADD",
          fid: 1689,
          timestamp: 126968968,
          network: "FARCASTER_NETWORK_MAINNET",
          userDataBody: {
            type: "USER_DATA_TYPE_DISPLAY",
            value: "Stephan",
          },
        },
        hash: "0xd9593619238083a72b5b2e8b6d31a2e3a00e5df7",
        hashScheme: "HASH_SCHEME_BLAKE3",
        signature:
          "rJerSJ9K939W7D1ZsvheP7NIdmR+1gaOmjcPqOEfj1PbAj9tPwLk4pblxTXtBi2RtgqOhRyHjAJoa1DMRtfFAg==",
        signatureScheme: "SIGNATURE_SCHEME_ED25519",
        signer:
          "0xa5f666cac97ae9f09f78cfaaa624ea2a1f03f042aa87c955d0113275e54e9cfe",
      };

      const parsedMessage = Message.fromJSON(httpMessage);
      await (worker as any).addUserDataToBatch(parsedMessage);

      // Trigger batch flush
      await (worker as any).flushAllBatches();

      // Check that mockBatchInsert was called
      expect(mockBatchInsert).toHaveBeenCalled();
      const expectedTimestamp = fromFarcasterTime(126968968)._unsafeUnwrap();

      expect(mockBatchInsert).toHaveBeenCalledWith(
        mockSchema.userData,
        expect.arrayContaining([
          expect.objectContaining({
            type: "display",
            value: "Stephan",
            timestamp: new Date(expectedTimestamp),
          }),
        ]),
        expect.objectContaining({
          batchSize: 100,
          onConflictDoNothing: true,
        })
      );
    });
  });

  describe("bytesToHex conversion", () => {
    it("should convert hash to hex string", () => {
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

      const parsedMessage = Message.fromJSON(httpMessage);

      // Verify hash is converted to hex string
      expect(typeof parsedMessage.hash).toBe("object"); // Should be Uint8Array
      expect(parsedMessage.hash).toBeInstanceOf(Uint8Array);

      // Verify bytesToHex works
      const hexHash = bytesToHex(parsedMessage.hash);
      expect(typeof hexHash).toBe("string");
      expect(hexHash).toMatch(/^0x[0-9a-f]+$/);
    });
  });
});
