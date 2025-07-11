// Shared types for the admin web interface

export interface Target {
  fid: number;
  isRoot: boolean;
  addedAt: string;
  lastSyncedAt: string | null;
  syncStatus: "synced" | "unsynced" | "waiting";
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
  followerCount?: number;
  followingCount?: number;
  castCount?: number;
}

export interface ClientTarget {
  clientFid: number;
  addedAt: string;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  discoveredTargets?: number;
}

export interface JobData {
  fid?: number;
  targetCount?: number;
  [key: string]: unknown;
}

export interface Job {
  id: string;
  name: string;
  data: JobData;
  status: "active" | "waiting" | "completed" | "failed" | "delayed";
  progress: number;
  createdAt: string;
  processedAt?: string;
  finishedAt?: string;
  error?: string;
  duration?: number;
}

export interface QueueStats {
  name: string;
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "down";
  uptime: number;
  lastSync: string;
  services: {
    database: boolean;
    redis: boolean;
    hubs: boolean;
  };
}

export interface DashboardStats {
  targets: {
    total: number;
    root: number;
    synced: number;
    unsynced: number;
    waiting: number;
  };
  clientTargets: {
    total: number;
  };
  jobs: {
    active: number;
    completed: number;
    failed: number;
    waiting: number;
  };
  system: SystemHealth;
}

export interface Cast {
  hash: string;
  fid: number;
  text: string;
  parentHash?: string | null;
  parentFid?: number | null;
  parentUrl?: string | null;
  timestamp: string;
  embeds?: string; // JSON string of embeds array
  mentions?: unknown[];
  mentionsPositions?: unknown[];
  createdAt?: string;
  user?: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
    bio?: string;
    custodyAddress?: string;
    syncedAt?: string;
  };
  // For trending/stats
  reactionCount?: string;
  stats?: {
    reactions?: string | number;
    likes?: number;
    recasts?: number;
    replies?: number;
  };
}

export interface Reaction {
  hash: string;
  fid: number;
  type: "like" | "recast";
  targetHash: string;
  timestamp: string;
  author?: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
}

export interface Link {
  hash: string;
  fid: number;
  targetFid: number;
  type: "follow";
  timestamp: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}
