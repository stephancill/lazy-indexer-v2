import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { app } from "./server.js";

describe("API Server", () => {
  describe("Health Check", () => {
    it("should return healthy status", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe("healthy");
      expect(data.service).toBe("farcaster-indexer-api");
      expect(data.timestamp).toBeDefined();
    });
  });

  describe("404 Handler", () => {
    it("should return 404 for non-existent endpoints", async () => {
      const res = await app.request("/non-existent");
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe("Not Found");
    });
  });

  describe("CORS Headers", () => {
    it("should include CORS headers for API routes", async () => {
      const res = await app.request("/api/v1/non-existent", {
        headers: {
          Origin: "http://localhost:3000",
        },
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000"
      );
    });
  });

  describe("Security Headers", () => {
    it("should include security headers", async () => {
      const res = await app.request("/health");
      expect(res.headers.get("X-Content-Type-Options")).toBeTruthy();
      expect(res.headers.get("X-Frame-Options")).toBeTruthy();
    });
  });
});
