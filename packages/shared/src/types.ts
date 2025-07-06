export interface HubConfig {
  url: string;
  transformRequest?: (init: RequestInit) => RequestInit;
}

export interface StrategyConfig {
  rootTargets: number[];
  targetClients: number[];
  enableClientDiscovery: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface PostgresConfig {
  connectionString: string;
  testConnectionString?: string;
  poolSize?: number;
  logQueries?: boolean;
}

export interface AuthConfig {
  jwtSecret: string;
  adminPassword: string;
}

export interface ConcurrencyConfig {
  backfill: number;
  realtime: number;
}

export interface Config {
  hubs: HubConfig[];
  strategy: StrategyConfig;
  redis: RedisConfig;
  postgres: PostgresConfig;
  auth: AuthConfig;
  concurrency: ConcurrencyConfig;
}

export interface Target {
  fid: number;
  is_root: boolean;
  added_at: Date;
  last_synced_at: Date | null;
}

export interface User {
  fid: number;
  username: string | null;
  display_name: string | null;
  pfp_url: string | null;
  bio: string | null;
  custody_address: string | null;
  synced_at: Date;
}

export interface Cast {
  hash: string;
  fid: number;
  text: string;
  parent_hash: string | null;
  parent_fid: number | null;
  parent_url: string | null;
  timestamp: Date;
  embeds: string | null;
}

export interface Reaction {
  hash: string;
  fid: number;
  type: "like" | "recast";
  target_hash: string;
  timestamp: Date;
}

export interface Link {
  hash: string;
  fid: number;
  target_fid: number;
  type: "follow";
  timestamp: Date;
}

export interface Verification {
  hash: string;
  fid: number;
  address: string;
  protocol: "ethereum";
  timestamp: Date;
}

export interface TargetClient {
  client_fid: number;
  added_at: Date;
}

export interface FarcasterHttpMessage {
  data: {
    type: string;
    fid: number;
    timestamp: number;
    network: string;
    castAddBody?: {
      text: string;
      embeds: Array<{
        url?: string;
        castId?: {
          fid: number;
          hash: string;
        };
      }>;
      mentions: number[];
      mentionsPositions: number[];
      parentCastId?: {
        fid: number;
        hash: string;
      };
      parentUrl?: string;
    };
    castRemoveBody?: {
      targetHash: string;
    };
    reactionBody?: {
      type: "REACTION_TYPE_LIKE" | "REACTION_TYPE_RECAST";
      targetCastId?: {
        fid: number;
        hash: string;
      };
      targetUrl?: string;
    };
    linkBody?: {
      type: "follow" | "unfollow";
      targetFid: number;
    };
    userDataBody?: {
      type:
        | "USER_DATA_TYPE_PFP"
        | "USER_DATA_TYPE_DISPLAY"
        | "USER_DATA_TYPE_BIO"
        | "USER_DATA_TYPE_USERNAME"
        | "USER_DATA_TYPE_URL"
        | "USER_DATA_TYPE_LOCATION"
        | "USER_DATA_TYPE_TWITTER"
        | "USER_DATA_TYPE_GITHUB"
        | "USER_DATA_TYPE_BANNER"
        | "USER_DATA_TYPE_USER_DATA_PRIMARY_ADDRESS_ETHEREUM"
        | "USER_DATA_TYPE_USER_DATA_PRIMARY_ADDRESS_SOLANA";
      value: string;
    };
    verificationAddEthAddressBody?: {
      address: string;
      ethSignature: string;
      blockHash: string;
    };
    verificationRemoveBody?: {
      address: string;
    };
  };
  hash: string;
  hashScheme: string;
  signature: string;
  signatureScheme: string;
  signer: string;
}

export interface FarcasterHttpEvent {
  type:
    | "HUB_EVENT_TYPE_MERGE_MESSAGE"
    | "HUB_EVENT_TYPE_PRUNE_MESSAGE"
    | "HUB_EVENT_TYPE_REVOKE_MESSAGE"
    | "HUB_EVENT_TYPE_MERGE_ON_CHAIN_EVENT";
  id: number;
  fid?: number;
  mergeMessageBody?: {
    message: FarcasterHttpMessage;
    deletedMessages: FarcasterHttpMessage[];
  };
  pruneMessageBody?: {
    message: FarcasterHttpMessage;
  };
  revokeMessageBody?: {
    message: FarcasterHttpMessage;
  };
  mergeOnChainEventBody?: {
    onChainEvent: {
      type:
        | "EVENT_TYPE_SIGNER_ADD"
        | "EVENT_TYPE_SIGNER_REMOVE"
        | "EVENT_TYPE_ID_REGISTER";
      chainId: number;
      blockNumber: number;
      blockHash: string;
      blockTimestamp: number;
      transactionHash: string;
      logIndex: number;
      fid: number;
      signerEventBody?: {
        key: string;
        keyType: number;
        eventType: "SIGNER_EVENT_TYPE_ADD" | "SIGNER_EVENT_TYPE_REMOVE";
        metadata: string;
        metadataType: number;
      };
      idRegisterEventBody?: {
        to: string;
        eventType: "EVENT_TYPE_ID_REGISTER" | "EVENT_TYPE_ID_TRANSFER";
        from?: string;
        recoveryAddress: string;
      };
    };
  };
}

export interface PaginationOptions {
  pageSize?: number;
  pageToken?: string;
  reverse?: boolean;
}

export interface HubResponse<T> {
  messages?: T[];
  events?: T[];
  nextPageToken?: string;
}

export interface JobData {
  [key: string]: unknown;
}

export interface BackfillJobData extends JobData {
  fid: number;
  isRoot: boolean;
}

export interface RealtimeSyncJobData extends JobData {
  lastEventId?: number;
}

export interface ProcessEventJobData extends JobData {
  event: FarcasterHttpEvent;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  messages: T[];
  nextPageToken?: string;
}

export interface PaginatedEventsResponse<T> {
  events: T[];
  nextPageToken?: string;
}

// Specific message types for hub client
export type CastMessage = FarcasterHttpMessage;
export type ReactionMessage = FarcasterHttpMessage;
export type LinkMessage = FarcasterHttpMessage;
export type VerificationMessage = FarcasterHttpMessage;
export type UserDataMessage = FarcasterHttpMessage;
export type UsernameProofMessage = FarcasterHttpMessage;
export interface OnChainEvent {
  type: string;
  chainId: number;
  blockNumber: number;
  blockHash: string;
  blockTimestamp: number;
  transactionHash: string;
  logIndex: number;
  fid: number;
  signerEventBody?: {
    key: string;
    keyType: number;
    eventType: string;
    metadata: string;
    metadataType: number;
  };
  idRegisterEventBody?: {
    to: string;
    eventType: string;
    from?: string;
    recoveryAddress: string;
  };
}

// Hub info response
export interface HubInfoResponse {
  version: string;
  nickname?: string;
  rootHash?: string;
  dbStats: {
    numMessages: number;
    numFidRegistrations: number;
    approxSize: number;
  };
  numShards?: number;
  shardInfos?: Array<{
    shardId: number;
    maxHeight: number;
    numMessages: number;
    numFidRegistrations: number;
    approxSize: number;
    blockDelay: number;
    mempoolSize: number;
  }>;
  peer_id?: string;
}

export interface AuthTokenPayload {
  exp: number;
  iat: number;
  admin: boolean;
}

export interface TargetStats {
  fid: number;
  cast_count: number;
  reaction_count: number;
  link_count: number;
  follower_count: number;
  following_count: number;
  last_cast_at: Date | null;
  last_activity_at: Date | null;
}

export interface JobStats {
  queue: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface SystemStats {
  targets: {
    total: number;
    root: number;
    synced: number;
    unsynced: number;
  };
  clients: {
    total: number;
  };
  messages: {
    casts: number;
    reactions: number;
    links: number;
    verifications: number;
  };
  jobs: JobStats[];
}
