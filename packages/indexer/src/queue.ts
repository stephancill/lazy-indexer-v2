import { Queue, Worker, QueueEvents, type Job } from "bullmq";
import { Redis } from "ioredis";
import { config } from "@farcaster-indexer/shared";
import type {
  BackfillJobData,
  RealtimeSyncJobData,
  ProcessEventJobData,
  JobStats,
} from "@farcaster-indexer/shared";

// Redis connection configuration
const redisConfig = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db || 0,
  maxRetriesPerRequest: null, // Required for BullMQ
  retryDelayOnFailure: 1000,
  enableReadyCheck: true,
  lazyConnect: true,
};

// Create Redis connections for different purposes
export const redisConnection = new Redis(redisConfig);
export const redisPublisher = new Redis(redisConfig);
export const redisSubscriber = new Redis(redisConfig);

// Queue configurations
const queueConfig = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
};

// Create queues
export const backfillQueue = new Queue<BackfillJobData>(
  "backfill",
  queueConfig
);
export const realtimeQueue = new Queue<RealtimeSyncJobData>(
  "realtime",
  queueConfig
);
export const processEventQueue = new Queue<ProcessEventJobData>(
  "process-event",
  queueConfig
);

// Queue events for monitoring
export const backfillQueueEvents = new QueueEvents("backfill", {
  connection: redisConnection,
});
export const realtimeQueueEvents = new QueueEvents("realtime", {
  connection: redisConnection,
});
export const processEventQueueEvents = new QueueEvents("process-event", {
  connection: redisConnection,
});

// Job type definitions
export type BackfillJob = Job<BackfillJobData>;
export type RealtimeSyncJob = Job<RealtimeSyncJobData>;
export type ProcessEventJob = Job<ProcessEventJobData>;

// Worker creation utilities
export function createBackfillWorker(
  processor: (job: BackfillJob) => Promise<void>
) {
  return new Worker<BackfillJobData>(
    "backfill",
    async (job: BackfillJob) => {
      try {
        await processor(job);
      } catch (error) {
        console.error(`Backfill job ${job.id} failed:`, error);
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: config.concurrency.backfill,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );
}

export function createRealtimeWorker(
  processor: (job: RealtimeSyncJob) => Promise<void>
) {
  return new Worker<RealtimeSyncJobData>(
    "realtime",
    async (job: RealtimeSyncJob) => {
      try {
        await processor(job);
      } catch (error) {
        console.error(`Realtime job ${job.id} failed:`, error);
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: config.concurrency.realtime,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );
}

export function createProcessEventWorker(
  processor: (job: ProcessEventJob) => Promise<void>
) {
  return new Worker<ProcessEventJobData>(
    "process-event",
    async (job: ProcessEventJob) => {
      try {
        await processor(job);
      } catch (error) {
        console.error(`Process event job ${job.id} failed:`, error);
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 10, // Higher concurrency for event processing
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );
}

// Job scheduling utilities
export async function scheduleBackfillJob(
  fid: number,
  isRoot: boolean,
  delay = 0
) {
  const jobData: BackfillJobData = { fid, isRoot };

  return backfillQueue.add(`backfill-${fid}`, jobData, {
    delay,
    jobId: `backfill-${fid}`, // Ensure unique job ID to prevent duplicates
  });
}

export async function scheduleRealtimeSync(lastEventId?: number) {
  const jobData: RealtimeSyncJobData = { lastEventId };

  return realtimeQueue.add("realtime-sync", jobData, {
    repeat: { every: 5000 }, // Poll every 5 seconds
    jobId: "realtime-sync", // Single recurring job
  });
}

export async function scheduleEventProcessing(
  event: ProcessEventJobData["event"]
) {
  const jobData: ProcessEventJobData = { event };

  return processEventQueue.add(`process-event-${event.id}`, jobData, {
    priority: 1, // High priority for event processing
  });
}

// Queue management utilities
export async function pauseQueue(queueName: string) {
  const queue = getQueue(queueName);
  if (queue) {
    await queue.pause();
  }
}

export async function resumeQueue(queueName: string) {
  const queue = getQueue(queueName);
  if (queue) {
    await queue.resume();
  }
}

export async function clearQueue(queueName: string) {
  const queue = getQueue(queueName);
  if (queue) {
    await queue.drain();
  }
}

export async function getQueueStats(
  queueName: string
): Promise<JobStats | null> {
  const queue = getQueue(queueName);
  if (!queue) return null;

  const [waiting, active, completed, failed, delayed, paused] =
    await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
      queue.isPaused(),
    ]);

  return {
    queue: queueName,
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    delayed: delayed.length,
    paused: paused ? 1 : 0,
  };
}

export async function getAllQueueStats(): Promise<JobStats[]> {
  const queues = ["backfill", "realtime", "process-event"];
  const stats = await Promise.all(queues.map((q) => getQueueStats(q)));
  return stats.filter((s) => s !== null) as JobStats[];
}

function getQueue(queueName: string) {
  switch (queueName) {
    case "backfill":
      return backfillQueue;
    case "realtime":
      return realtimeQueue;
    case "process-event":
      return processEventQueue;
    default:
      return null;
  }
}

// Redis Set utilities for target management
export async function addTargetToSet(fid: number) {
  await redisConnection.sadd("targets", fid.toString());
}

export async function removeTargetFromSet(fid: number) {
  await redisConnection.srem("targets", fid.toString());
}

export async function isTargetInSet(fid: number): Promise<boolean> {
  const result = await redisConnection.sismember("targets", fid.toString());
  return result === 1;
}

export async function loadTargetsIntoSet(fids: number[]) {
  if (fids.length === 0) return;

  const fidStrings = fids.map((fid) => fid.toString());
  await redisConnection.sadd("targets", ...fidStrings);
}

export async function clearTargetSet() {
  await redisConnection.del("targets");
}

// Client targets management
export async function addClientTargetToSet(fid: number) {
  await redisConnection.sadd("client-targets", fid.toString());
}

export async function removeClientTargetFromSet(fid: number) {
  await redisConnection.srem("client-targets", fid.toString());
}

export async function isClientTargetInSet(fid: number): Promise<boolean> {
  const result = await redisConnection.sismember(
    "client-targets",
    fid.toString()
  );
  return result === 1;
}

export async function loadClientTargetsIntoSet(fids: number[]) {
  if (fids.length === 0) return;

  const fidStrings = fids.map((fid) => fid.toString());
  await redisConnection.sadd("client-targets", ...fidStrings);
}

export async function clearClientTargetSet() {
  await redisConnection.del("client-targets");
}

// Graceful shutdown
export async function shutdown() {
  console.log("Shutting down queue system...");

  // Close all queues
  await Promise.all([
    backfillQueue.close(),
    realtimeQueue.close(),
    processEventQueue.close(),
  ]);

  // Close queue events
  await Promise.all([
    backfillQueueEvents.close(),
    realtimeQueueEvents.close(),
    processEventQueueEvents.close(),
  ]);

  // Close Redis connections
  await Promise.all([
    redisConnection.disconnect(),
    redisPublisher.disconnect(),
    redisSubscriber.disconnect(),
  ]);

  console.log("Queue system shut down successfully");
}

// Error handling for Redis connections
redisConnection.on("error", (error) => {
  console.error("Redis connection error:", error);
});

redisConnection.on("connect", () => {
  console.log("Redis connected successfully");
});

// Setup process event handlers for graceful shutdown
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Initialize target and client target sets on startup
export async function initializeTargetSets() {
  try {
    const { db, schema } = await import("@farcaster-indexer/shared");

    // Load all targets into Redis set
    const allTargets = await db
      .select({ fid: schema.targets.fid })
      .from(schema.targets);
    const targetFids = allTargets.map((t) => t.fid);

    if (targetFids.length > 0) {
      await loadTargetsIntoSet(targetFids);
      console.log(`Loaded ${targetFids.length} targets into Redis set`);
    }

    // Load all client targets into Redis set
    const allClientTargets = await db
      .select({ client_fid: schema.targetClients.clientFid })
      .from(schema.targetClients);
    const clientFids = allClientTargets.map((t) => t.client_fid);

    if (clientFids.length > 0) {
      await loadClientTargetsIntoSet(clientFids);
      console.log(`Loaded ${clientFids.length} client targets into Redis set`);
    }
  } catch (error) {
    console.error("Failed to initialize target sets:", error);
  }
}
