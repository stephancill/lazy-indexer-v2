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

export interface FarcasterMessage {
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
      type: "LIKE" | "RECAST";
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
      type: "PFP" | "DISPLAY" | "BIO" | "USERNAME";
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

export interface FarcasterEvent {
  type:
    | "MERGE_MESSAGE"
    | "PRUNE_MESSAGE"
    | "REVOKE_MESSAGE"
    | "MERGE_ON_CHAIN_EVENT";
  id: number;
  fid?: number;
  mergeMessageBody?: {
    message: FarcasterMessage;
    deletedMessages: FarcasterMessage[];
  };
  pruneMessageBody?: {
    message: FarcasterMessage;
  };
  revokeMessageBody?: {
    message: FarcasterMessage;
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
        eventType: "ADD" | "REMOVE";
        metadata: string;
        metadataType: number;
      };
      idRegisterEventBody?: {
        to: string;
        eventType: "REGISTER" | "TRANSFER";
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
  [key: string]: any;
}

export interface BackfillJobData extends JobData {
  fid: number;
  isRoot: boolean;
}

export interface RealtimeSyncJobData extends JobData {
  lastEventId?: number;
}

export interface ProcessEventJobData extends JobData {
  event: FarcasterEvent;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
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
