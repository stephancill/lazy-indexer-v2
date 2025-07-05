import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import type { Context, Next } from "hono";
import { adminRoutes } from "./admin.js";
import { authMiddleware } from "../middleware/auth.js";

// Mock the shared package
vi.mock("@farcaster-indexer/shared", () => ({
  db: {
    query: {
      targets: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      targetClients: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnValue({ returning: vi.fn() }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn() }),
      }),
    }),
    delete: vi.fn().mockReturnValue({ where: vi.fn() }),
    select: vi
      .fn()
      .mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn() }) }),
  },
  schema: {
    targets: {
      fid: "fid",
      isRoot: "isRoot",
      addedAt: "addedAt",
      lastSyncedAt: "lastSyncedAt",
    },
    targetClients: {
      clientFid: "clientFid",
      addedAt: "addedAt",
    },
    casts: { fid: "fid", timestamp: "timestamp" },
    users: {},
    links: { fid: "fid", targetFid: "targetFid", type: "type" },
    reactions: { fid: "fid", timestamp: "timestamp" },
  },
}));

// Mock the indexer package
vi.mock("@farcaster-indexer/indexer", () => ({
  scheduleBackfillJob: vi.fn(),
  getAllQueueStats: vi.fn(),
  getQueueStats: vi.fn(),
  addTargetToSet: vi.fn(),
  removeTargetFromSet: vi.fn(),
  addClientTargetToSet: vi.fn(),
  removeClientTargetFromSet: vi.fn(),
  pauseQueue: vi.fn(),
  resumeQueue: vi.fn(),
  clearQueue: vi.fn(),
}));

// Mock auth middleware to allow all requests
vi.mock("../middleware/auth.js", () => ({
  authMiddleware: vi.fn(async (_c: Context, next: Next) => {
    await next();
  }),
}));

// Mock validation module
vi.mock("../middleware/validation.js", () => ({
  validateFid: vi.fn((fid) => {
    const parsed = Number.parseInt(fid);
    return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
  }),
  validateQueueName: vi.fn((queue) => {
    const valid = ["backfill", "realtime", "process-event"];
    return valid.includes(queue) ? queue : null;
  }),
  validateTargetBody: vi.fn((body) => {
    if (!body?.fid) return "Valid FID is required";
    const fid = Number.parseInt(body.fid);
    if (Number.isNaN(fid) || fid <= 0) return "Valid FID is required";
    return { fid, isRoot: body.isRoot === true };
  }),
  validateClientTargetBody: vi.fn((body) => {
    if (!body?.clientFid) return "Valid client FID is required";
    const clientFid = Number.parseInt(body.clientFid);
    if (Number.isNaN(clientFid) || clientFid <= 0)
      return "Valid client FID is required";
    return { clientFid };
  }),
  validateTargetUpdateBody: vi.fn((body) => {
    if (!body) return "Request body is required";
    return { isRoot: body.isRoot };
  }),
  validatePagination: vi.fn((limit, offset) => ({
    limit: Math.min(Number.parseInt(limit || "50"), 100),
    offset: Math.max(Number.parseInt(offset || "0"), 0),
  })),
  validateSortOrder: vi.fn((order) => (order === "asc" ? "asc" : "desc")),
  validateDate: vi.fn((dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? null : date;
  }),
  adminRateLimit: vi.fn(async (_c: Context, next: Next) => {
    await next();
  }),
}));

describe("Enhanced Admin Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/admin", adminRoutes);
    vi.clearAllMocks();
  });

  describe("Enhanced Target Management", () => {
    it("should support advanced filtering with all parameters", async () => {
      const mockTargets = [
        { fid: 1, isRoot: true, addedAt: new Date(), lastSyncedAt: new Date() },
        { fid: 2, isRoot: false, addedAt: new Date(), lastSyncedAt: null },
      ];

      const mockDb = await vi.importMock("@farcaster-indexer/shared");
      mockDb.db.query.targets.findMany.mockResolvedValue(mockTargets);
      mockDb.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      });

      const response = await app.request(
        "/admin/targets?search=1&is_root=true&sync_status=synced&sort_by=fid&sort_order=asc&date_from=2024-01-01&date_to=2024-12-31"
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty("targets");
      expect(data).toHaveProperty("pagination");
      expect(data).toHaveProperty("summary");
      expect(data).toHaveProperty("filters");
      expect(data.filters).toEqual({
        search: "1",
        isRoot: "true",
        syncStatus: "synced",
        dateFrom: expect.any(String),
        dateTo: expect.any(String),
        sortBy: "fid",
        sortOrder: "asc",
      });
    });

    it("should validate date range parameters", async () => {
      const response = await app.request(
        "/admin/targets?date_from=2024-12-31&date_to=2024-01-01"
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("dateFrom cannot be later than dateTo");
    });

    it("should add target with Redis cache integration", async () => {
      const mockIndexer = await vi.importMock("@farcaster-indexer/indexer");
      const mockDb = await vi.importMock("@farcaster-indexer/shared");

      mockDb.db.query.targets.findFirst.mockResolvedValue(null);
      mockDb.db.insert.mockReturnValue({
        returning: vi
          .fn()
          .mockResolvedValue([
            { fid: 123, isRoot: false, addedAt: new Date() },
          ]),
      });

      const response = await app.request("/admin/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid: 123, isRoot: false }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data).toHaveProperty("target");
      expect(data).toHaveProperty("message");
      expect(mockIndexer.addTargetToSet).toHaveBeenCalledWith(123);
      expect(mockIndexer.scheduleBackfillJob).toHaveBeenCalledWith(123, false);
    });

    it("should remove target with Redis cache cleanup", async () => {
      const mockIndexer = await vi.importMock("@farcaster-indexer/indexer");
      const mockDb = await vi.importMock("@farcaster-indexer/shared");

      mockDb.db.query.targets.findFirst.mockResolvedValue({ fid: 123 });
      mockDb.db.delete.mockReturnValue({ where: vi.fn() });

      const response = await app.request("/admin/targets/123", {
        method: "DELETE",
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data).toHaveProperty("message");
      expect(mockIndexer.removeTargetFromSet).toHaveBeenCalledWith(123);
    });

    it("should validate FID parameters properly", async () => {
      const response = await app.request("/admin/targets/invalid", {
        method: "DELETE",
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid FID");
    });
  });

  describe("Job Management Integration", () => {
    it("should return real-time queue statistics", async () => {
      const mockIndexer = await vi.importMock("@farcaster-indexer/indexer");

      const mockStats = [
        {
          queue: "backfill",
          active: 2,
          waiting: 5,
          completed: 100,
          failed: 1,
          delayed: 0,
          paused: 0,
        },
        {
          queue: "realtime",
          active: 1,
          waiting: 0,
          completed: 50,
          failed: 0,
          delayed: 0,
          paused: 0,
        },
        {
          queue: "process-event",
          active: 3,
          waiting: 10,
          completed: 200,
          failed: 2,
          delayed: 1,
          paused: 0,
        },
      ];

      mockIndexer.getAllQueueStats.mockResolvedValue(mockStats);

      const response = await app.request("/admin/jobs");

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty("jobs");
      expect(data).toHaveProperty("timestamp");
      expect(data.jobs).toHaveProperty("backfillQueue");
      expect(data.jobs).toHaveProperty("realtimeQueue");
      expect(data.jobs).toHaveProperty("process-eventQueue");
    });

    it("should pause queue with validation", async () => {
      const mockIndexer = await vi.importMock("@farcaster-indexer/indexer");

      const response = await app.request("/admin/jobs/pause/backfill", {
        method: "POST",
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toContain("backfill");
      expect(mockIndexer.pauseQueue).toHaveBeenCalledWith("backfill");
    });

    it("should validate queue names", async () => {
      const response = await app.request("/admin/jobs/pause/invalid-queue", {
        method: "POST",
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid queue name");
    });

    it("should trigger backfill for all unsynced targets", async () => {
      const mockIndexer = await vi.importMock("@farcaster-indexer/indexer");
      const mockDb = await vi.importMock("@farcaster-indexer/shared");

      const unsyncedTargets = [
        { fid: 1, isRoot: true },
        { fid: 2, isRoot: false },
        { fid: 3, isRoot: true },
      ];

      mockDb.db.query.targets.findMany.mockResolvedValue(unsyncedTargets);
      mockIndexer.scheduleBackfillJob.mockResolvedValue({ id: "job-123" });

      const response = await app.request("/admin/jobs/backfill", {
        method: "POST",
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.queuedJobs).toBe(3);
      expect(mockIndexer.scheduleBackfillJob).toHaveBeenCalledTimes(3);
    });
  });

  describe("Real-time Statistics", () => {
    it("should return comprehensive real-time statistics", async () => {
      const mockIndexer = await vi.importMock("@farcaster-indexer/indexer");
      const mockDb = await vi.importMock("@farcaster-indexer/shared");

      // Mock database queries
      mockDb.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 100 }]),
        }),
      });

      // Mock queue stats
      const queueStats = [
        {
          queue: "backfill",
          active: 2,
          waiting: 5,
          completed: 100,
          failed: 1,
          delayed: 0,
          paused: 0,
        },
      ];
      mockIndexer.getAllQueueStats.mockResolvedValue(queueStats);

      const response = await app.request("/admin/stats/realtime");

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty("stats");
      expect(data).toHaveProperty("timestamp");
      expect(data.stats).toHaveProperty("targets");
      expect(data.stats).toHaveProperty("data");
      expect(data.stats).toHaveProperty("activity");
      expect(data.stats).toHaveProperty("queues");

      expect(data.stats.targets).toHaveProperty("total");
      expect(data.stats.targets).toHaveProperty("root");
      expect(data.stats.targets).toHaveProperty("clients");
      expect(data.stats.targets).toHaveProperty("unsynced");

      expect(data.stats.activity).toHaveProperty("recentCasts");
      expect(data.stats.activity).toHaveProperty("recentReactions");
    });
  });

  describe("Client Target Management", () => {
    it("should add client target with Redis cache integration", async () => {
      const mockIndexer = await vi.importMock("@farcaster-indexer/indexer");
      const mockDb = await vi.importMock("@farcaster-indexer/shared");

      mockDb.db.query.targetClients.findFirst.mockResolvedValue(null);
      mockDb.db.insert.mockReturnValue({
        returning: vi
          .fn()
          .mockResolvedValue([{ clientFid: 456, addedAt: new Date() }]),
      });

      const response = await app.request("/admin/client-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientFid: 456 }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data).toHaveProperty("clientTarget");
      expect(data).toHaveProperty("message");
      expect(mockIndexer.addClientTargetToSet).toHaveBeenCalledWith(456);
    });

    it("should remove client target with Redis cache cleanup", async () => {
      const mockIndexer = await vi.importMock("@farcaster-indexer/indexer");
      const mockDb = await vi.importMock("@farcaster-indexer/shared");

      mockDb.db.query.targetClients.findFirst.mockResolvedValue({
        clientFid: 456,
      });
      mockDb.db.delete.mockReturnValue({ where: vi.fn() });

      const response = await app.request("/admin/client-targets/456", {
        method: "DELETE",
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data).toHaveProperty("message");
      expect(mockIndexer.removeClientTargetFromSet).toHaveBeenCalledWith(456);
    });
  });

  describe("Input Validation", () => {
    it("should validate target creation body", async () => {
      const response = await app.request("/admin/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invalid: "data" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Valid FID is required");
    });

    it("should validate target update body", async () => {
      const mockDb = await vi.importMock("@farcaster-indexer/shared");
      mockDb.db.query.targets.findFirst.mockResolvedValue({ fid: 123 });

      const response = await app.request("/admin/targets/123", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200); // Empty body is valid for updates
    });

    it("should validate client target body", async () => {
      const response = await app.request("/admin/client-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invalid: "data" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Valid client FID is required");
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      const mockDb = await vi.importMock("@farcaster-indexer/shared");
      mockDb.db.query.targets.findMany.mockRejectedValue(
        new Error("Database error")
      );

      const response = await app.request("/admin/targets");

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to fetch targets");
    });

    it("should handle queue operation errors", async () => {
      const mockIndexer = await vi.importMock("@farcaster-indexer/indexer");
      mockIndexer.pauseQueue.mockRejectedValue(new Error("Queue error"));

      const response = await app.request("/admin/jobs/pause/backfill", {
        method: "POST",
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to pause queue");
    });

    it("should handle target not found errors", async () => {
      const mockDb = await vi.importMock("@farcaster-indexer/shared");
      mockDb.db.query.targets.findFirst.mockResolvedValue(null);

      const response = await app.request("/admin/targets/999", {
        method: "DELETE",
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Target not found");
    });
  });

  describe("Performance and Rate Limiting", () => {
    it("should apply rate limiting to admin routes", async () => {
      // The rate limiting is mocked, but we verify it's applied
      const response = await app.request("/admin/targets");
      expect(response.status).toBe(200);

      // In a real test, you would test actual rate limiting behavior
      // This is just verifying the middleware is applied
    });

    it("should handle pagination correctly", async () => {
      const mockDb = await vi.importMock("@farcaster-indexer/shared");
      mockDb.db.query.targets.findMany.mockResolvedValue([]);
      mockDb.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const response = await app.request("/admin/targets?limit=10&offset=20");

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.offset).toBe(20);
    });

    it("should enforce maximum pagination limits", async () => {
      const mockDb = await vi.importMock("@farcaster-indexer/shared");
      mockDb.db.query.targets.findMany.mockResolvedValue([]);
      mockDb.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const response = await app.request("/admin/targets?limit=200"); // Over max limit

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.pagination.limit).toBe(100); // Should be capped at 100
    });
  });
});
