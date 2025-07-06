import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  userDataTypeToString,
  apiUserDataTypeToString,
  convertFarcasterTime,
  convertMessageHash,
  parseMessageFromJson,
  createCastRecord,
  createReactionRecord,
  createLinkRecord,
  createVerificationRecord,
  createUserDataRecord,
  createOnChainEventRecord,
  createCastRecordFromApiMessage,
  createReactionRecordFromApiMessage,
  createLinkRecordFromApiMessage,
  createVerificationRecordFromApiMessage,
  createUserDataRecordFromApiMessage,
} from "./message-parser.js";
import {
  Message,
  MessageType,
  ReactionType,
  UserDataType,
  fromFarcasterTime,
} from "@farcaster/core";
import { bytesToHex } from "viem";
import type { FarcasterHttpMessage } from "../types.js";

// Mock external dependencies
vi.mock("@farcaster/core", async () => {
  const actual = await vi.importActual("@farcaster/core");
  return {
    ...actual,
    fromFarcasterTime: vi.fn(),
    Message: {
      fromJSON: vi.fn(),
    },
  };
});

vi.mock("viem", () => ({
  bytesToHex: vi.fn(),
}));

const mockFromFarcasterTime = vi.mocked(fromFarcasterTime);
const mockMessageFromJSON = vi.mocked(Message.fromJSON);
const mockBytesToHex = vi.mocked(bytesToHex);

describe("message-parser utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("userDataTypeToString", () => {
    it("should convert UserDataType enum values to strings", () => {
      expect(userDataTypeToString(UserDataType.PFP)).toBe("pfp");
      expect(userDataTypeToString(UserDataType.DISPLAY)).toBe("display");
      expect(userDataTypeToString(UserDataType.BIO)).toBe("bio");
      expect(userDataTypeToString(UserDataType.USERNAME)).toBe("username");
      expect(userDataTypeToString(UserDataType.URL)).toBe("url");
      expect(userDataTypeToString(UserDataType.LOCATION)).toBe("location");
      expect(userDataTypeToString(UserDataType.TWITTER)).toBe("twitter");
      expect(userDataTypeToString(UserDataType.GITHUB)).toBe("github");
      expect(userDataTypeToString(UserDataType.BANNER)).toBe("banner");
      expect(
        userDataTypeToString(UserDataType.USER_DATA_PRIMARY_ADDRESS_ETHEREUM)
      ).toBe("ethereum_address");
      expect(
        userDataTypeToString(UserDataType.USER_DATA_PRIMARY_ADDRESS_SOLANA)
      ).toBe("solana_address");
    });

    it("should return 'unknown' for undefined values", () => {
      expect(userDataTypeToString(999 as UserDataType)).toBe("unknown");
    });
  });

  describe("apiUserDataTypeToString", () => {
    it("should convert API user data type strings to readable strings", () => {
      expect(apiUserDataTypeToString("USER_DATA_TYPE_PFP")).toBe("pfp");
      expect(apiUserDataTypeToString("USER_DATA_TYPE_DISPLAY")).toBe("display");
      expect(apiUserDataTypeToString("USER_DATA_TYPE_BIO")).toBe("bio");
      expect(apiUserDataTypeToString("USER_DATA_TYPE_USERNAME")).toBe(
        "username"
      );
      expect(apiUserDataTypeToString("USER_DATA_TYPE_URL")).toBe("url");
      expect(apiUserDataTypeToString("USER_DATA_TYPE_LOCATION")).toBe(
        "location"
      );
      expect(apiUserDataTypeToString("USER_DATA_TYPE_TWITTER")).toBe("twitter");
      expect(apiUserDataTypeToString("USER_DATA_TYPE_GITHUB")).toBe("github");
      expect(apiUserDataTypeToString("USER_DATA_TYPE_BANNER")).toBe("banner");
      expect(
        apiUserDataTypeToString(
          "USER_DATA_TYPE_USER_DATA_PRIMARY_ADDRESS_ETHEREUM"
        )
      ).toBe("ethereum_address");
      expect(
        apiUserDataTypeToString(
          "USER_DATA_TYPE_USER_DATA_PRIMARY_ADDRESS_SOLANA"
        )
      ).toBe("solana_address");
    });

    it("should return 'unknown' for undefined values", () => {
      expect(apiUserDataTypeToString("INVALID_TYPE")).toBe("unknown");
      expect(apiUserDataTypeToString("")).toBe("unknown");
    });
  });

  describe("convertFarcasterTime", () => {
    it("should convert valid Farcaster timestamp to Date", () => {
      const timestamp = 1234567890;
      const expectedDate = new Date(timestamp * 1000);

      mockFromFarcasterTime.mockReturnValue({
        isErr: () => false,
        value: timestamp * 1000,
      } as any);

      const result = convertFarcasterTime(timestamp);
      expect(result).toEqual(expectedDate);
      expect(mockFromFarcasterTime).toHaveBeenCalledWith(timestamp);
    });

    it("should throw error for invalid Farcaster timestamp", () => {
      const invalidTimestamp = -1;

      mockFromFarcasterTime.mockReturnValue({
        isErr: () => true,
        value: undefined,
      } as any);

      expect(() => convertFarcasterTime(invalidTimestamp)).toThrow(
        `Invalid Farcaster timestamp: ${invalidTimestamp}`
      );
    });
  });

  describe("convertMessageHash", () => {
    it("should convert Uint8Array hash to hex string", () => {
      const hash = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
      const expectedHex = "0x12345678";

      mockBytesToHex.mockReturnValue(expectedHex);

      const result = convertMessageHash(hash);
      expect(result).toBe(expectedHex);
      expect(mockBytesToHex).toHaveBeenCalledWith(hash);
    });
  });

  describe("parseMessageFromJson", () => {
    it("should parse HTTP message to Message object", () => {
      const httpMessage: FarcasterHttpMessage = {
        data: {
          type: "MESSAGE_TYPE_CAST_ADD",
          fid: 123,
          timestamp: 1234567890,
          network: "FARCASTER_NETWORK_MAINNET",
          castAddBody: {
            text: "Hello world",
            embeds: [],
            mentions: [],
            mentionsPositions: [],
          },
        },
        hash: "0x1234",
        hashScheme: "HASH_SCHEME_BLAKE3",
        signature: "signature",
        signatureScheme: "SIGNATURE_SCHEME_ED25519",
        signer: "0xsigner",
      };

      const mockParsedMessage = {
        data: httpMessage.data,
      } as unknown as Message;
      mockMessageFromJSON.mockReturnValue(mockParsedMessage);

      const result = parseMessageFromJson(httpMessage);
      expect(result).toBe(mockParsedMessage);
      expect(mockMessageFromJSON).toHaveBeenCalledWith(httpMessage);
    });
  });

  describe("createCastRecord", () => {
    it("should create cast record from Message", () => {
      const message = {
        data: {
          type: MessageType.CAST_ADD,
          fid: 123,
          timestamp: 1234567890,
          castAddBody: {
            text: "Hello world",
            parentCastId: {
              fid: 456,
              hash: new Uint8Array([0x12, 0x34]),
            },
            parentUrl: "https://example.com",
            embeds: [{ url: "https://test.com" }],
          },
        },
        hash: new Uint8Array([0x56, 0x78]),
      } as Message;

      mockFromFarcasterTime.mockReturnValue({
        isErr: () => false,
        value: 1234567890000,
      } as any);
      mockBytesToHex.mockImplementation(
        (bytes) =>
          `0x${Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")}`
      );

      const result = createCastRecord(message);

      expect(result).toEqual({
        hash: "0x5678",
        fid: 123,
        text: "Hello world",
        parentHash: "0x1234",
        parentFid: 456,
        parentUrl: "https://example.com",
        timestamp: new Date(1234567890000),
        embeds: JSON.stringify([{ url: "https://test.com" }]),
      });
    });

    it("should return null for non-cast messages", () => {
      const message = {
        data: {
          type: MessageType.REACTION_ADD,
          fid: 123,
        },
      } as Message;

      const result = createCastRecord(message);
      expect(result).toBeNull();
    });

    it("should return null for message without data", () => {
      const message = { data: null } as unknown as Message;
      const result = createCastRecord(message);
      expect(result).toBeNull();
    });
  });

  describe("createReactionRecord", () => {
    it("should create reaction record from Message", () => {
      const message = {
        data: {
          type: MessageType.REACTION_ADD,
          fid: 123,
          timestamp: 1234567890,
          reactionBody: {
            type: ReactionType.LIKE,
            targetCastId: {
              hash: new Uint8Array([0x12, 0x34]),
              fid: 456,
            },
          },
        },
        hash: new Uint8Array([0x56, 0x78]),
      } as Message;

      mockFromFarcasterTime.mockReturnValue({
        isErr: () => false,
        value: 1234567890000,
      } as any);
      mockBytesToHex.mockImplementation(
        (bytes) =>
          `0x${Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")}`
      );

      const result = createReactionRecord(message);

      expect(result).toEqual({
        hash: "0x5678",
        fid: 123,
        type: "like",
        targetHash: "0x1234",
        timestamp: new Date(1234567890000),
      });
    });

    it("should handle recast type", () => {
      const message = {
        data: {
          type: MessageType.REACTION_ADD,
          fid: 123,
          timestamp: 1234567890,
          reactionBody: {
            type: ReactionType.RECAST,
            targetCastId: {
              hash: new Uint8Array([0x12, 0x34]),
              fid: 456,
            },
          },
        },
        hash: new Uint8Array([0x56, 0x78]),
      } as Message;

      mockFromFarcasterTime.mockReturnValue({
        isErr: () => false,
        value: 1234567890000,
      } as any);
      mockBytesToHex.mockImplementation(
        (bytes) =>
          `0x${Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")}`
      );

      const result = createReactionRecord(message);

      expect(result).toEqual({
        hash: "0x5678",
        fid: 123,
        type: "recast",
        targetHash: "0x1234",
        timestamp: new Date(1234567890000),
      });
    });

    it("should return null for non-reaction messages", () => {
      const message = {
        data: {
          type: MessageType.CAST_ADD,
          fid: 123,
        },
      } as Message;

      const result = createReactionRecord(message);
      expect(result).toBeNull();
    });
  });

  describe("createLinkRecord", () => {
    it("should create link record from Message", () => {
      const message = {
        data: {
          type: MessageType.LINK_ADD,
          fid: 123,
          timestamp: 1234567890,
          linkBody: {
            targetFid: 456,
            type: "follow",
          },
        },
        hash: new Uint8Array([0x56, 0x78]),
      } as Message;

      mockFromFarcasterTime.mockReturnValue({
        isErr: () => false,
        value: 1234567890000,
      } as any);
      mockBytesToHex.mockImplementation(
        (bytes) =>
          `0x${Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")}`
      );

      const result = createLinkRecord(message);

      expect(result).toEqual({
        hash: "0x5678",
        fid: 123,
        targetFid: 456,
        type: "follow",
        timestamp: new Date(1234567890000),
      });
    });

    it("should return null for non-link messages", () => {
      const message = {
        data: {
          type: MessageType.CAST_ADD,
          fid: 123,
        },
      } as Message;

      const result = createLinkRecord(message);
      expect(result).toBeNull();
    });
  });

  describe("createVerificationRecord", () => {
    it("should create verification record from Message", () => {
      const message = {
        data: {
          type: MessageType.VERIFICATION_ADD_ETH_ADDRESS,
          fid: 123,
          timestamp: 1234567890,
          verificationAddAddressBody: {
            address: new Uint8Array([0x12, 0x34, 0x56, 0x78]),
            claimSignature: new Uint8Array([]),
            blockHash: new Uint8Array([]),
            verificationType: 0,
          },
        },
        hash: new Uint8Array([0x56, 0x78]),
      } as Message;

      mockFromFarcasterTime.mockReturnValue({
        isErr: () => false,
        value: 1234567890000,
      } as any);
      mockBytesToHex.mockImplementation(
        (bytes) =>
          `0x${Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")}`
      );

      const result = createVerificationRecord(message);

      expect(result).toEqual({
        hash: "0x5678",
        fid: 123,
        address: "0x12345678",
        protocol: "ethereum",
        timestamp: new Date(1234567890000),
      });
    });

    it("should return null for non-verification messages", () => {
      const message = {
        data: {
          type: MessageType.CAST_ADD,
          fid: 123,
        },
      } as Message;

      const result = createVerificationRecord(message);
      expect(result).toBeNull();
    });
  });

  describe("createUserDataRecord", () => {
    it("should create user data record from Message", () => {
      const message = {
        data: {
          type: MessageType.USER_DATA_ADD,
          fid: 123,
          timestamp: 1234567890,
          userDataBody: {
            type: UserDataType.USERNAME,
            value: "testuser",
          },
        },
        hash: new Uint8Array([0x56, 0x78]),
      } as Message;

      mockFromFarcasterTime.mockReturnValue({
        isErr: () => false,
        value: 1234567890000,
      } as any);
      mockBytesToHex.mockImplementation(
        (bytes) =>
          `0x${Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")}`
      );

      const result = createUserDataRecord(message);

      expect(result).toEqual({
        hash: "0x5678",
        fid: 123,
        type: "username",
        value: "testuser",
        timestamp: new Date(1234567890000),
      });
    });

    it("should return null for non-user-data messages", () => {
      const message = {
        data: {
          type: MessageType.CAST_ADD,
          fid: 123,
        },
      } as Message;

      const result = createUserDataRecord(message);
      expect(result).toBeNull();
    });
  });

  describe("createOnChainEventRecord", () => {
    it("should create on-chain event record", () => {
      const onChainEvent = {
        type: "EVENT_TYPE_SIGNER_ADD",
        chainId: 1,
        blockNumber: 123456,
        blockHash: "0xblockhash",
        blockTimestamp: 1234567890,
        transactionHash: "0xtxhash",
        logIndex: 0,
        fid: 123,
        signerEventBody: { signer: "0xsigner" },
        idRegisterEventBody: null,
      };

      const result = createOnChainEventRecord(onChainEvent);

      expect(result).toEqual({
        type: "EVENT_TYPE_SIGNER_ADD",
        chainId: 1,
        blockNumber: 123456,
        blockHash: "0xblockhash",
        blockTimestamp: new Date(1234567890 * 1000),
        transactionHash: "0xtxhash",
        logIndex: 0,
        fid: 123,
        signerEventBody: JSON.stringify({ signer: "0xsigner" }),
        idRegistryEventBody: null,
      });
    });

    it("should handle missing optional fields", () => {
      const onChainEvent = {
        type: "EVENT_TYPE_ID_REGISTER",
        chainId: 1,
        blockNumber: undefined,
        blockHash: "0xblockhash",
        blockTimestamp: 1234567890,
        transactionHash: "0xtxhash",
        logIndex: 0,
        fid: 123,
        signerEventBody: null,
        idRegisterEventBody: { to: "0xaddress" },
      };

      const result = createOnChainEventRecord(onChainEvent);

      expect(result).toEqual({
        type: "EVENT_TYPE_ID_REGISTER",
        chainId: 1,
        blockNumber: 0,
        blockHash: "0xblockhash",
        blockTimestamp: new Date(1234567890 * 1000),
        transactionHash: "0xtxhash",
        logIndex: 0,
        fid: 123,
        signerEventBody: null,
        idRegistryEventBody: JSON.stringify({ to: "0xaddress" }),
      });
    });
  });

  describe("API message factory functions", () => {
    describe("createCastRecordFromApiMessage", () => {
      it("should create cast record from API message format", () => {
        const apiMessage = {
          hash: "0x1234",
          data: {
            fid: 123,
            timestamp: 1234567890,
            castAddBody: {
              text: "Hello world",
              parentCastId: {
                fid: 456,
                hash: "0x5678",
              },
              parentUrl: "https://example.com",
              embeds: [{ url: "https://test.com" }],
            },
          },
        };

        const result = createCastRecordFromApiMessage(apiMessage as any);

        expect(result).toEqual({
          hash: "0x1234",
          fid: 123,
          text: "Hello world",
          parentHash: "0x5678",
          parentFid: 456,
          parentUrl: "https://example.com",
          timestamp: new Date(1234567890 * 1000),
          embeds: JSON.stringify([{ url: "https://test.com" }]),
        });
      });
    });

    describe("createReactionRecordFromApiMessage", () => {
      it("should create reaction record from API message format", () => {
        const apiMessage = {
          hash: "0x1234",
          data: {
            fid: 123,
            timestamp: 1234567890,
            reactionBody: {
              type: "REACTION_TYPE_LIKE",
              targetCastId: {
                hash: "0x5678",
              },
            },
          },
        };

        const result = createReactionRecordFromApiMessage(apiMessage as any);

        expect(result).toEqual({
          hash: "0x1234",
          fid: 123,
          type: "like",
          targetHash: "0x5678",
          timestamp: new Date(1234567890 * 1000),
        });
      });

      it("should handle recast type from API message", () => {
        const apiMessage = {
          hash: "0x1234",
          data: {
            fid: 123,
            timestamp: 1234567890,
            reactionBody: {
              type: "REACTION_TYPE_RECAST",
              targetCastId: {
                hash: "0x5678",
              },
            },
          },
        };

        const result = createReactionRecordFromApiMessage(apiMessage as any);

        expect(result).toEqual({
          hash: "0x1234",
          fid: 123,
          type: "recast",
          targetHash: "0x5678",
          timestamp: new Date(1234567890 * 1000),
        });
      });
    });

    describe("createLinkRecordFromApiMessage", () => {
      it("should create link record from API message format", () => {
        const apiMessage = {
          hash: "0x1234",
          data: {
            fid: 123,
            timestamp: 1234567890,
            linkBody: {
              targetFid: 456,
            },
          },
        };

        const result = createLinkRecordFromApiMessage(apiMessage as any);

        expect(result).toEqual({
          hash: "0x1234",
          fid: 123,
          targetFid: 456,
          type: "follow",
          timestamp: new Date(1234567890 * 1000),
        });
      });
    });

    describe("createVerificationRecordFromApiMessage", () => {
      it("should create verification record from API message format", () => {
        const apiMessage = {
          hash: "0x1234",
          data: {
            fid: 123,
            timestamp: 1234567890,
            verificationAddEthAddressBody: {
              address: "0x5678",
            },
          },
        };

        const result = createVerificationRecordFromApiMessage(
          apiMessage as any
        );

        expect(result).toEqual({
          hash: "0x1234",
          fid: 123,
          address: "0x5678",
          protocol: "ethereum",
          timestamp: new Date(1234567890 * 1000),
        });
      });
    });

    describe("createUserDataRecordFromApiMessage", () => {
      it("should create user data record from API message format", () => {
        const apiMessage = {
          hash: "0x1234",
          data: {
            fid: 123,
            timestamp: 1234567890,
            userDataBody: {
              type: "USER_DATA_TYPE_USERNAME",
              value: "testuser",
            },
          },
        };

        const result = createUserDataRecordFromApiMessage(apiMessage as any);

        expect(result).toEqual({
          hash: "0x1234",
          fid: 123,
          type: "username",
          value: "testuser",
          timestamp: new Date(1234567890 * 1000),
        });
      });

      it("should handle different user data types from API", () => {
        const apiMessage = {
          hash: "0x5678",
          data: {
            fid: 456,
            timestamp: 1234567890,
            userDataBody: {
              type: "USER_DATA_TYPE_BIO",
              value: "My bio",
            },
          },
        };

        const result = createUserDataRecordFromApiMessage(apiMessage as any);

        expect(result).toEqual({
          hash: "0x5678",
          fid: 456,
          type: "bio",
          value: "My bio",
          timestamp: new Date(1234567890 * 1000),
        });
      });

      it("should handle unknown user data types from API", () => {
        const apiMessage = {
          hash: "0x9999",
          data: {
            fid: 789,
            timestamp: 1234567890,
            userDataBody: {
              type: "INVALID_TYPE",
              value: "some value",
            },
          },
        };

        const result = createUserDataRecordFromApiMessage(apiMessage as any);

        expect(result).toEqual({
          hash: "0x9999",
          fid: 789,
          type: "unknown",
          value: "some value",
          timestamp: new Date(1234567890 * 1000),
        });
      });
    });
  });
});
