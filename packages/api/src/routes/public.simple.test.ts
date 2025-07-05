import { describe, it, expect } from "vitest";
import { Hono } from "hono";

describe("Simple Public Routes Test", () => {
  it("should create a simple route", async () => {
    const app = new Hono();

    app.get("/test", (c) => {
      return c.json({ message: "Hello Test" });
    });

    const res = await app.request("/test");
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.message).toBe("Hello Test");
  });

  it("should handle route parameters", async () => {
    const app = new Hono();

    app.get("/users/:fid", (c) => {
      const fid = c.req.param("fid");
      const fidNum = Number.parseInt(fid);

      if (Number.isNaN(fidNum) || fidNum <= 0) {
        return c.json({ error: "Invalid FID" }, 400);
      }

      return c.json({ fid: fidNum, message: "User found" });
    });

    // Valid FID
    const res1 = await app.request("/users/123");
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.fid).toBe(123);

    // Invalid FID
    const res2 = await app.request("/users/invalid");
    expect(res2.status).toBe(400);
    const data2 = await res2.json();
    expect(data2.error).toBe("Invalid FID");
  });
});
