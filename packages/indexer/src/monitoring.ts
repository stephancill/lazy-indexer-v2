import { Hono } from "hono";
import { backfillQueue, realtimeQueue, processEventQueue } from "./queue.js";

// Create Hono app for monitoring
export const monitoringApp = new Hono();

// Simple queue monitoring endpoints (BullBoard will be integrated in API server)
monitoringApp.get("/admin/queues", async (c) => {
  return c.json({
    message: "Queue monitoring endpoints",
    queues: ["backfill", "realtime", "process-event"],
    note: "Full BullBoard dashboard will be available in API server",
  });
});

// Export queue adapters for use in API server
export const queueAdapters = {
  backfillQueue,
  realtimeQueue,
  processEventQueue,
};

// Additional monitoring endpoints
monitoringApp.get("/health", async (c) => {
  try {
    const { getAllQueueStats } = await import("./queue.js");
    const stats = await getAllQueueStats();

    return c.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      queues: stats,
    });
  } catch (error) {
    return c.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

monitoringApp.get("/stats", async (c) => {
  try {
    const { getAllQueueStats } = await import("./queue.js");
    const stats = await getAllQueueStats();

    return c.json({
      queues: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// Queue management will be handled by the API server
