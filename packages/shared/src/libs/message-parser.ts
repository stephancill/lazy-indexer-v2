import type {
  FarcasterHttpMessage,
  CastMessage,
  ReactionMessage,
  LinkMessage,
  VerificationMessage,
  UserDataMessage,
  OnChainEvent,
} from "../types.js";
import {
  Message,
  MessageType,
  ReactionType,
  UserDataType,
  fromFarcasterTime,
} from "@farcaster/core";
import { bytesToHex } from "viem";

// Helper function to convert UserDataType enum to human-readable string
export function userDataTypeToString(type: UserDataType): string {
  switch (type) {
    case UserDataType.PFP:
      return "pfp";
    case UserDataType.DISPLAY:
      return "display";
    case UserDataType.BIO:
      return "bio";
    case UserDataType.USERNAME:
      return "username";
    case UserDataType.URL:
      return "url";
    case UserDataType.LOCATION:
      return "location";
    case UserDataType.TWITTER:
      return "twitter";
    case UserDataType.GITHUB:
      return "github";
    case UserDataType.BANNER:
      return "banner";
    case UserDataType.USER_DATA_PRIMARY_ADDRESS_ETHEREUM:
      return "ethereum_address";
    case UserDataType.USER_DATA_PRIMARY_ADDRESS_SOLANA:
      return "solana_address";
    default:
      return "unknown";
  }
}

// Helper function to convert API user data type strings to readable strings
export function apiUserDataTypeToString(apiType: string): string {
  switch (apiType) {
    case "USER_DATA_TYPE_PFP":
      return "pfp";
    case "USER_DATA_TYPE_DISPLAY":
      return "display";
    case "USER_DATA_TYPE_BIO":
      return "bio";
    case "USER_DATA_TYPE_USERNAME":
      return "username";
    case "USER_DATA_TYPE_URL":
      return "url";
    case "USER_DATA_TYPE_LOCATION":
      return "location";
    case "USER_DATA_TYPE_TWITTER":
      return "twitter";
    case "USER_DATA_TYPE_GITHUB":
      return "github";
    case "USER_DATA_TYPE_BANNER":
      return "banner";
    case "USER_DATA_TYPE_USER_DATA_PRIMARY_ADDRESS_ETHEREUM":
      return "ethereum_address";
    case "USER_DATA_TYPE_USER_DATA_PRIMARY_ADDRESS_SOLANA":
      return "solana_address";
    // Handle the raw API types without the "USER_DATA_TYPE_" prefix
    case "USER_DATA_PRIMARY_ADDRESS_ETHEREUM":
      return "ethereum_address";
    case "USER_DATA_PRIMARY_ADDRESS_SOLANA":
      return "solana_address";
    default:
      return "unknown";
  }
}

// Helper function to safely convert Farcaster timestamp to Date
export function convertFarcasterTime(timestamp: number): Date {
  const result = fromFarcasterTime(timestamp);
  if (result.isErr()) {
    throw new Error(`Invalid Farcaster timestamp: ${timestamp}`);
  }
  return new Date(result.value);
}

// Helper function to convert Message hash to hex string
export function convertMessageHash(hash: Uint8Array): string {
  return bytesToHex(hash);
}

// Parse a Message object from JSON (from HTTP API)
export function parseMessageFromJson(
  httpMessage: FarcasterHttpMessage
): Message {
  return Message.fromJSON(httpMessage);
}

// Database record factory functions
export interface CastRecord {
  hash: string;
  fid: number;
  text: string;
  parentHash: string | null;
  parentFid: number | null;
  parentUrl: string | null;
  timestamp: Date;
  embeds: string | null;
  mentions: number[] | null;
  mentionsPositions: number[] | null;
}

export interface ReactionRecord {
  hash: string;
  fid: number;
  type: "like" | "recast";
  targetHash: string;
  timestamp: Date;
}

export interface LinkRecord {
  hash: string;
  fid: number;
  targetFid: number;
  type: "follow";
  timestamp: Date;
}

export interface VerificationRecord {
  hash: string;
  fid: number;
  address: string;
  protocol: "ethereum";
  timestamp: Date;
}

export interface UserDataRecord {
  hash: string;
  fid: number;
  type: string;
  value: string;
  timestamp: Date;
}

export interface OnChainEventRecord {
  type: string;
  chainId: number;
  blockNumber: number;
  blockHash: string;
  blockTimestamp: Date;
  transactionHash: string;
  logIndex: number;
  fid: number;
  signerEventBody: string | null;
  idRegistryEventBody: string | null;
}

// Factory function to create cast record from Message
export function createCastRecord(message: Message): CastRecord | null {
  if (!message.data || message.data.type !== MessageType.CAST_ADD) {
    return null;
  }

  const castData = message.data.castAddBody;
  if (!castData) return null;

  return {
    hash: convertMessageHash(message.hash),
    fid: message.data.fid,
    text: castData.text,
    parentHash: castData.parentCastId?.hash
      ? convertMessageHash(castData.parentCastId.hash)
      : null,
    parentFid: castData.parentCastId?.fid || null,
    parentUrl: castData.parentUrl || null,
    timestamp: convertFarcasterTime(message.data.timestamp),
    embeds: castData.embeds ? JSON.stringify(castData.embeds) : null,
    mentions:
      castData.mentions && castData.mentions.length > 0
        ? castData.mentions
        : null,
    mentionsPositions:
      castData.mentionsPositions && castData.mentionsPositions.length > 0
        ? castData.mentionsPositions
        : null,
  };
}

// Factory function to create reaction record from Message
export function createReactionRecord(message: Message): ReactionRecord | null {
  if (!message.data || message.data.type !== MessageType.REACTION_ADD) {
    return null;
  }

  const reactionData = message.data.reactionBody;
  if (!reactionData || !reactionData.targetCastId) return null;

  return {
    hash: convertMessageHash(message.hash),
    fid: message.data.fid,
    type: reactionData.type === ReactionType.LIKE ? "like" : "recast",
    targetHash: convertMessageHash(reactionData.targetCastId.hash),
    timestamp: convertFarcasterTime(message.data.timestamp),
  };
}

// Factory function to create link record from Message
export function createLinkRecord(message: Message): LinkRecord | null {
  if (!message.data || message.data.type !== MessageType.LINK_ADD) {
    return null;
  }

  const linkData = message.data.linkBody;
  if (!linkData) return null;

  return {
    hash: convertMessageHash(message.hash),
    fid: message.data.fid,
    targetFid: linkData.targetFid || 0,
    type: "follow",
    timestamp: convertFarcasterTime(message.data.timestamp),
  };
}

// Factory function to create verification record from Message
export function createVerificationRecord(
  message: Message
): VerificationRecord | null {
  if (
    !message.data ||
    message.data.type !== MessageType.VERIFICATION_ADD_ETH_ADDRESS
  ) {
    return null;
  }

  const verificationData = message.data.verificationAddAddressBody;
  if (!verificationData) return null;

  return {
    hash: convertMessageHash(message.hash),
    fid: message.data.fid,
    address: bytesToHex(verificationData.address),
    protocol: "ethereum",
    timestamp: convertFarcasterTime(message.data.timestamp),
  };
}

// Factory function to create user data record from Message
export function createUserDataRecord(message: Message): UserDataRecord | null {
  if (!message.data || message.data.type !== MessageType.USER_DATA_ADD) {
    return null;
  }

  const userDataBody = message.data.userDataBody;
  if (!userDataBody) return null;

  return {
    hash: convertMessageHash(message.hash),
    fid: message.data.fid,
    type: userDataTypeToString(userDataBody.type),
    value: userDataBody.value,
    timestamp: convertFarcasterTime(message.data.timestamp),
  };
}

// Factory function to create on-chain event record
export function createOnChainEventRecord(
  onChainEvent: any
): OnChainEventRecord {
  return {
    type: onChainEvent.type,
    chainId: onChainEvent.chainId,
    blockNumber: onChainEvent.blockNumber || 0,
    blockHash: onChainEvent.blockHash,
    blockTimestamp: new Date(onChainEvent.blockTimestamp * 1000),
    transactionHash: onChainEvent.transactionHash,
    logIndex: onChainEvent.logIndex,
    fid: onChainEvent.fid,
    signerEventBody: onChainEvent.signerEventBody
      ? JSON.stringify(onChainEvent.signerEventBody)
      : null,
    idRegistryEventBody: onChainEvent.idRegisterEventBody
      ? JSON.stringify(onChainEvent.idRegisterEventBody)
      : null,
  };
}

// Factory functions for legacy API message format (used in backfill)
export function createCastRecordFromApiMessage(
  message: CastMessage
): CastRecord {
  return {
    hash: message.hash,
    fid: message.data.fid,
    text: message.data.castAddBody?.text || "",
    parentHash: message.data.castAddBody?.parentCastId?.hash || null,
    parentFid: message.data.castAddBody?.parentCastId?.fid || null,
    parentUrl: message.data.castAddBody?.parentUrl || null,
    timestamp: convertFarcasterTime(message.data.timestamp),
    embeds: message.data.castAddBody?.embeds
      ? JSON.stringify(message.data.castAddBody.embeds)
      : null,
    mentions:
      message.data.castAddBody?.mentions &&
      message.data.castAddBody.mentions.length > 0
        ? message.data.castAddBody.mentions
        : null,
    mentionsPositions:
      message.data.castAddBody?.mentionsPositions &&
      message.data.castAddBody.mentionsPositions.length > 0
        ? message.data.castAddBody.mentionsPositions
        : null,
  };
}

export function createReactionRecordFromApiMessage(
  message: ReactionMessage
): ReactionRecord {
  return {
    hash: message.hash,
    fid: message.data.fid,
    type:
      message.data.reactionBody?.type === "REACTION_TYPE_LIKE"
        ? "like"
        : "recast",
    targetHash: message.data.reactionBody?.targetCastId?.hash || "",
    timestamp: convertFarcasterTime(message.data.timestamp),
  };
}

export function createLinkRecordFromApiMessage(
  message: LinkMessage
): LinkRecord {
  return {
    hash: message.hash,
    fid: message.data.fid,
    targetFid: message.data.linkBody?.targetFid || 0,
    type: "follow",
    timestamp: convertFarcasterTime(message.data.timestamp),
  };
}

export function createVerificationRecordFromApiMessage(
  message: VerificationMessage
): VerificationRecord {
  return {
    hash: message.hash,
    fid: message.data.fid,
    address: message.data.verificationAddEthAddressBody?.address || "",
    protocol: "ethereum",
    timestamp: convertFarcasterTime(message.data.timestamp),
  };
}

export function createUserDataRecordFromApiMessage(
  message: UserDataMessage
): UserDataRecord {
  return {
    hash: message.hash,
    fid: message.data.fid,
    type: apiUserDataTypeToString(message.data.userDataBody?.type || ""),
    value: message.data.userDataBody?.value || "",
    timestamp: convertFarcasterTime(message.data.timestamp),
  };
}
