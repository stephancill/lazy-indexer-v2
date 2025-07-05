import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "./public.js";

// Mock the database
vi.mock("@farcaster-indexer/shared", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      casts: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      links: {
        findMany: vi.fn(),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => [{ count: 10 }]),
      })),
    })),
  },
  schema: {
    casts: {},
    users: {},
    links: {},
    reactions: {},
  },
}));

// Create test app with public routes
const testApp = new Hono();
testApp.route("/v1", publicRoutes);

describe("Public Routes", () => {
  describe("GET /v1/users/:fid", () => {
    it("should return user profile with valid FID", async () => {
      const mockUser = {
        fid: 1,
        username: "testuser",
        displayName: "Test User",
        bio: "Test bio",
        pfpUrl: "https://example.com/pfp.jpg",
        custodyAddress: "0x123...",
        syncedAt: new Date(),
      };

      // Mock database response
      const { db } = await import("@farcaster-indexer/shared");
      vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => [{ count: 5 }]),
        })),
      } as any);

      const res = await testApp.request("/v1/users/1");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.user.fid).toBe(1);
      expect(data.user.username).toBe("testuser");
      expect(data.user.stats).toBeDefined();
    });

    it("should return 400 for invalid FID", async () => {
      const res = await testApp.request("/v1/users/invalid");
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toBe("Invalid FID");
    });

    it("should return 404 for non-existent user", async () => {
      const { db } = await import("@farcaster-indexer/shared");
      vi.mocked(db.query.users.findFirst).mockResolvedValue(null);

      const res = await testApp.request("/v1/users/999");
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe("User not found");
    });
  });

  describe("GET /v1/casts/:hash", () => {
    it("should return cast with valid hash", async () => {
      const mockCast = {
        hash: "0x1234567890abcdef1234567890abcdef12345678",
        fid: 1,
        text: "Test cast",
        timestamp: new Date(),
        user: {
          fid: 1,
          username: "testuser",
        },
      };

      const { db } = await import("@farcaster-indexer/shared");
      vi.mocked(db.query.casts.findFirst).mockResolvedValue(mockCast);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => [{ count: 3 }]),
        })),
      } as any);

      const res = await testApp.request(
        "/v1/casts/0x1234567890abcdef1234567890abcdef12345678"
      );
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.cast.hash).toBe("0x1234567890abcdef1234567890abcdef12345678");
      expect(data.cast.text).toBe("Test cast");
      expect(data.cast.stats).toBeDefined();
    });

    it("should return 400 for invalid hash", async () => {
      const res = await testApp.request("/v1/casts/invalid");
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toBe("Invalid cast hash");
    });

    it("should return 404 for non-existent cast", async () => {
      const { db } = await import("@farcaster-indexer/shared");
      vi.mocked(db.query.casts.findFirst).mockResolvedValue(null);

      const res = await testApp.request(
        "/v1/casts/0x1234567890abcdef1234567890abcdef12345678"
      );
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe("Cast not found");
    });
  });

  describe("GET /v1/feed/:fid", () => {
    it("should return feed for valid FID", async () => {
      const mockFollowing = [{ targetFid: 2 }, { targetFid: 3 }];
      const mockCasts = [
        {
          hash: "0x1234567890abcdef1234567890abcdef12345678",
          fid: 2,
          text: "Test cast 1",
          timestamp: new Date(),
          user: { fid: 2, username: "user2" },
        },
        {
          hash: "0x2234567890abcdef1234567890abcdef12345678",
          fid: 3,
          text: "Test cast 2",
          timestamp: new Date(),
          user: { fid: 3, username: "user3" },
        },
      ];

      const { db } = await import("@farcaster-indexer/shared");
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => mockFollowing),
        })),
      } as any);
      vi.mocked(db.query.casts.findMany).mockResolvedValue(mockCasts);
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => [{ count: 50 }]),
        })),
      } as any);

      const res = await testApp.request("/v1/feed/1");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.feed).toHaveLength(2);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBe(50);
    });

    it("should return empty feed for user with no following", async () => {
      const { db } = await import("@farcaster-indexer/shared");
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => []),
        })),
      } as any);

      const res = await testApp.request("/v1/feed/1");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.feed).toHaveLength(0);
      expect(data.pagination.total).toBe(0);
    });

    it("should handle pagination parameters", async () => {
      const mockFollowing = [{ targetFid: 2 }];
      const mockCasts = [
        {
          hash: "0x1234567890abcdef1234567890abcdef12345678",
          fid: 2,
          text: "Test cast 1",
          timestamp: new Date(),
          user: { fid: 2, username: "user2" },
        },
      ];

      const { db } = await import("@farcaster-indexer/shared");
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => mockFollowing),
        })),
      } as any);
      vi.mocked(db.query.casts.findMany).mockResolvedValue(mockCasts);
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => [{ count: 100 }]),
        })),
      } as any);

      const res = await testApp.request("/v1/feed/1?limit=10&offset=20");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.offset).toBe(20);
      expect(data.pagination.hasMore).toBe(true);
    });
  });

  describe("GET /v1/users/:fid/casts", () => {
    it("should return user casts with pagination", async () => {
      const mockCasts = [
        {
          hash: "0x1234567890abcdef1234567890abcdef12345678",
          fid: 1,
          text: "User cast 1",
          timestamp: new Date(),
          user: { fid: 1, username: "testuser" },
        },
      ];

      const { db } = await import("@farcaster-indexer/shared");
      vi.mocked(db.query.casts.findMany).mockResolvedValue(mockCasts);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => [{ count: 25 }]),
        })),
      } as any);

      const res = await testApp.request("/v1/users/1/casts");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.casts).toHaveLength(1);
      expect(data.pagination.total).toBe(25);
    });
  });

  describe("GET /v1/users/:fid/followers", () => {
    it("should return user followers with pagination", async () => {
      const mockFollowers = [
        {
          fid: 2,
          targetFid: 1,
          type: "follow",
          timestamp: new Date(),
          user: { fid: 2, username: "follower1" },
        },
      ];

      const { db } = await import("@farcaster-indexer/shared");
      vi.mocked(db.query.links.findMany).mockResolvedValue(mockFollowers);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => [{ count: 15 }]),
        })),
      } as any);

      const res = await testApp.request("/v1/users/1/followers");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.followers).toHaveLength(1);
      expect(data.pagination.total).toBe(15);
    });
  });

  describe("GET /v1/users/:fid/following", () => {
    it("should return user following with pagination", async () => {
      const mockFollowing = [
        {
          fid: 1,
          targetFid: 2,
          type: "follow",
          timestamp: new Date(),
          targetUser: { fid: 2, username: "following1" },
        },
      ];

      const { db } = await import("@farcaster-indexer/shared");
      vi.mocked(db.query.links.findMany).mockResolvedValue(mockFollowing);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => [{ count: 20 }]),
        })),
      } as any);

      const res = await testApp.request("/v1/users/1/following");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.following).toHaveLength(1);
      expect(data.pagination.total).toBe(20);
    });
  });

  describe("GET /v1/trending", () => {
    it("should return trending casts", async () => {
      const mockTrendingCasts = [
        {
          hash: "0x1234567890abcdef1234567890abcdef12345678",
          fid: 1,
          text: "Trending cast",
          timestamp: new Date(),
          parentHash: null,
          parentFid: null,
          parentUrl: null,
          embeds: null,
          reactionCount: 15,
        },
      ];

      const mockCastsWithUsers = [
        {
          hash: "0x1234567890abcdef1234567890abcdef12345678",
          fid: 1,
          text: "Trending cast",
          timestamp: new Date(),
          user: { fid: 1, username: "trendinguser" },
        },
      ];

      const { db } = await import("@farcaster-indexer/shared");
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              groupBy: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    offset: vi.fn(() => mockTrendingCasts),
                  })),
                })),
              })),
            })),
          })),
        })),
      } as any);
      vi.mocked(db.query.casts.findMany).mockResolvedValue(mockCastsWithUsers);

      const res = await testApp.request("/v1/trending");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.trending).toHaveLength(1);
      expect(data.trending[0].stats.reactions).toBe(15);
    });
  });
});
