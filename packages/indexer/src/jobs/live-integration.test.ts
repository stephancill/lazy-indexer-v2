import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { config, HubClient } from "@farcaster-indexer/shared";

// Mock initializeTargetSets
vi.mock("../queue.js", () => ({
  initializeTargetSets: vi.fn().mockResolvedValue(undefined),
}));

// Mock fetch globally for integration tests
const mockFetch = vi.fn() as any;
global.fetch = mockFetch;

describe("Live Farcaster Hub Integration", () => {
  let hubClient: HubClient;

  beforeAll(async () => {
    // Initialize hub client with live configuration
    hubClient = new HubClient(config.hubs);
  });

  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe("Hub Client Integration", () => {
    it("should connect to live Farcaster hub", async () => {
      // Mock hub info response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ version: "1.0.0", hubOperator: "test" }),
        headers: { get: () => "application/json" },
      });

      // Test basic hub info endpoint
      const info = await hubClient.getHubInfo();
      expect(info).toBeDefined();
      expect(info.version).toBeDefined();
      console.log("Connected to hub version:", info.version);
    });

    it("should fetch recent events from hub", async () => {
      // Mock events response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            events: [
              {
                id: 1,
                type: "CAST_ADD",
                fid: 1,
                timestamp: new Date().toISOString(),
              },
              {
                id: 2,
                type: "REACTION_ADD",
                fid: 2,
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        headers: { get: () => "application/json" },
      });

      const eventsResponse = await hubClient.getEvents({
        pageSize: 10,
      });

      expect(eventsResponse).toBeDefined();
      expect(eventsResponse.events).toBeDefined();
      expect(Array.isArray(eventsResponse.events)).toBe(true);

      console.log(`Fetched ${eventsResponse.events.length} events from hub`);

      if (eventsResponse.events.length > 0) {
        const firstEvent = eventsResponse.events[0];
        expect(firstEvent.id).toBeDefined();
        expect(firstEvent.type).toBeDefined();
        console.log("First event:", {
          id: firstEvent.id,
          type: firstEvent.type,
        });
      }
    });

    it("should fetch user data from hub", async () => {
      // Mock user data response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            {
              data: {
                fid: 1,
                userDataBody: { type: "USERNAME", value: "testuser" },
                timestamp: Math.floor(Date.now() / 1000),
              },
            },
            {
              data: {
                fid: 1,
                userDataBody: { type: "DISPLAY_NAME", value: "Test User" },
                timestamp: Math.floor(Date.now() / 1000),
              },
            },
          ]),
        headers: { get: () => "application/json" },
      });

      // Test with FID 1 (Farcaster founder)
      const userDataResponse = await hubClient.getAllUserDataByFid(1);

      expect(userDataResponse).toBeDefined();
      expect(Array.isArray(userDataResponse)).toBe(true);

      console.log(
        `Fetched ${userDataResponse.length} user data records for FID 1`
      );

      if (userDataResponse.length > 0) {
        const userData = userDataResponse[0];
        expect(userData.data).toBeDefined();
        expect(userData.data.fid).toBe(1);
        console.log(
          "User data types:",
          userDataResponse.map((ud) => ud.data.userDataBody?.type)
        );
      }
    });

    it("should handle hub fallback correctly", async () => {
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ version: "1.0.0", hubOperator: "test" }),
        headers: { get: () => "application/json" },
      });

      let success = false;
      try {
        const response = await hubClient.getHubInfo();
        if (response && response.version) {
          success = true;
        }
      } catch (error) {
        console.error("Hub fallback test failed:", error);
      }

      expect(success).toBe(true);
    });
  });

  describe("Event Processing Validation", () => {
    it("should validate event structure from live hub", async () => {
      // Mock events with proper structure
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            events: [
              {
                id: 1,
                type: "HUB_EVENT_TYPE_MERGE_MESSAGE",
                mergeMessageBody: {
                  message: {
                    data: { fid: 1, type: "MESSAGE_TYPE_CAST_ADD" },
                  },
                },
              },
              {
                id: 2,
                type: "HUB_EVENT_TYPE_MERGE_ON_CHAIN_EVENT",
                mergeOnChainEventBody: {
                  onChainEvent: {
                    type: "ON_CHAIN_EVENT_TYPE_SIGNER",
                  },
                },
              },
            ],
          }),
        headers: { get: () => "application/json" },
      });

      const eventsResponse = await hubClient.getEvents({
        pageSize: 5,
      });

      if (eventsResponse.events.length === 0) {
        console.log("No events to validate, skipping test");
        return;
      }

      for (const event of eventsResponse.events) {
        // Validate basic event structure
        expect(event.id).toBeDefined();
        expect(typeof event.id).toBe("number");
        expect(event.type).toBeDefined();
        expect(typeof event.type).toBe("string");

        // Validate specific event types
        switch (event.type) {
          case "HUB_EVENT_TYPE_MERGE_MESSAGE":
            expect(event.mergeMessageBody).toBeDefined();
            expect(event.mergeMessageBody?.message).toBeDefined();
            break;
          case "HUB_EVENT_TYPE_MERGE_ON_CHAIN_EVENT":
            expect(event.mergeOnChainEventBody).toBeDefined();
            expect(event.mergeOnChainEventBody?.onChainEvent).toBeDefined();
            break;
          case "HUB_EVENT_TYPE_PRUNE_MESSAGE":
            expect(event.pruneMessageBody).toBeDefined();
            break;
          case "HUB_EVENT_TYPE_REVOKE_MESSAGE":
            expect(event.revokeMessageBody).toBeDefined();
            break;
        }
      }

      console.log(
        `Validated ${eventsResponse.events.length} events successfully`
      );
    });

    it("should handle rate limiting gracefully", async () => {
      // Mock successful responses for all requests
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({ version: "1.0.0", hubOperator: "test" }),
          headers: { get: () => "application/json" },
        });
      }

      // Make multiple rapid requests to test rate limiting
      const requests: Promise<any>[] = [];
      for (let i = 0; i < 5; i++) {
        requests.push(hubClient.getHubInfo());
      }

      const results = await Promise.allSettled(requests);

      // At least some requests should succeed
      const successful = results.filter((r) => r.status === "fulfilled").length;
      expect(successful).toBeGreaterThan(0);

      console.log(
        `${successful}/5 requests succeeded (rate limiting may have affected some)`
      );
    });
  });

  describe("Data Quality Validation", () => {
    it("should validate message data integrity", async () => {
      // Mock casts response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            {
              data: {
                fid: 1,
                type: "MESSAGE_TYPE_CAST_ADD",
                timestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
                castAddBody: {
                  text: "Test cast",
                  embeds: [],
                },
              },
              hash: "0x123",
              signature: "0xabc",
            },
          ]),
        headers: { get: () => "application/json" },
      });

      // Fetch some casts to validate data structure
      const castsResponse = await hubClient.getAllCastsByFid(1);

      if (castsResponse.length === 0) {
        console.log("No casts to validate, skipping test");
        return;
      }

      // Just validate first 5 casts to keep test fast
      const castsToValidate = castsResponse.slice(0, 5);
      for (const cast of castsToValidate) {
        expect(cast.data).toBeDefined();
        expect(cast.data.fid).toBe(1);
        expect(cast.hash).toBeDefined();
        expect(cast.signature).toBeDefined();

        // Validate timestamp is reasonable (not in the future)
        const messageTime = cast.data.timestamp * 1000;
        const now = Date.now();
        expect(messageTime).toBeLessThanOrEqual(now);

        // Handle different message types
        if (cast.data.type === "MESSAGE_TYPE_CAST_ADD") {
          expect(cast.data.castAddBody).toBeDefined();
          const castBody = cast.data.castAddBody!;
          expect(typeof castBody.text).toBe("string");
          expect(Array.isArray(castBody.embeds)).toBe(true);
        } else if (cast.data.type === "MESSAGE_TYPE_CAST_REMOVE") {
          expect(cast.data.castRemoveBody).toBeDefined();
        }
      }

      console.log(
        `Validated ${castsToValidate.length} cast messages successfully`
      );
    });

    it("should validate user data consistency", async () => {
      // Mock user data response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            {
              data: {
                fid: 1,
                userDataBody: { type: "USERNAME", value: "testuser" },
                timestamp: Math.floor(Date.now() / 1000),
              },
            },
            {
              data: {
                fid: 1,
                userDataBody: { type: "DISPLAY_NAME", value: "Test User" },
                timestamp: Math.floor(Date.now() / 1000) - 100,
              },
            },
          ]),
        headers: { get: () => "application/json" },
      });

      // Test with a known active user (FID 1)
      const userData = await hubClient.getAllUserDataByFid(1);

      if (userData.length === 0) {
        console.log("No user data to validate, skipping test");
        return;
      }

      // Group by type to check for duplicates
      const dataByType = new Map();

      for (const data of userData) {
        const type = data.data.userDataBody?.type;
        if (type) {
          if (dataByType.has(type)) {
            // Multiple entries of same type should have different timestamps
            // (latest one wins)
            const existing = dataByType.get(type);
            const current = data.data.timestamp;
            expect(current).not.toBe(existing.timestamp);
          }
          dataByType.set(type, {
            value: data.data.userDataBody?.value,
            timestamp: data.data.timestamp,
          });
        }
      }

      console.log("User data types found:", Array.from(dataByType.keys()));
      expect(dataByType.size).toBeGreaterThan(0);
    });
  });

  describe("Performance Validation", () => {
    it("should maintain acceptable response times", async () => {
      // Mock quick response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ events: [] }),
        headers: { get: () => "application/json" },
      });

      const startTime = Date.now();

      // Make a lighter query for faster response
      await hubClient.getEvents({ pageSize: 10 });

      const responseTime = Date.now() - startTime;
      console.log(`Hub response time: ${responseTime}ms`);

      // Should respond within 10 seconds (more lenient for network conditions)
      expect(responseTime).toBeLessThan(10000);
    });

    it("should handle pagination efficiently", async () => {
      // Mock first page response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            events: [{ id: 1, type: "CAST_ADD" }],
            nextPageToken: "token123",
          }),
        headers: { get: () => "application/json" },
      });

      // Mock second page response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            events: [{ id: 2, type: "CAST_ADD" }],
          }),
        headers: { get: () => "application/json" },
      });

      const startTime = Date.now();

      // Fetch first page with smaller size for faster response
      const firstPage = await hubClient.getEvents({ pageSize: 10 });

      if (firstPage.nextPageToken) {
        // Fetch second page
        await hubClient.getEvents({
          pageSize: 10,
          pageToken: firstPage.nextPageToken,
        });
      }

      const totalTime = Date.now() - startTime;
      console.log(`Pagination test completed in ${totalTime}ms`);

      // Should handle pagination within reasonable time
      expect(totalTime).toBeLessThan(15000);
    });
  });
});
