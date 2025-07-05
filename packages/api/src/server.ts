import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { publicRoutes } from "./routes/public.js";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use("*", secureHeaders());
app.use("*", prettyJSON());

// CORS configuration - Allow specific origins in development
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow requests from localhost ports (for development)
      if (
        !origin ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        return origin;
      }
      // In production, you might want to restrict this to specific domains
      return null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "farcaster-indexer-api",
  });
});

// API routes
app.route("/api/auth", authRoutes);
app.route("/api/v1", publicRoutes);
app.route("/api/admin", adminRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((error, c) => {
  console.error("API Error:", error);
  return c.json(
    {
      error: "Internal Server Error",
      message:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Something went wrong",
    },
    500
  );
});

export default function startApiServer(port = 3000) {
  console.log(`🚀 Farcaster API Server starting on port ${port}...`);

  const server = serve({
    fetch: app.fetch,
    port: port,
  });

  console.log(`✅ API Server running at http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🔐 Admin login: http://localhost:${port}/api/auth/login`);

  return server;
}

export { app };

// Start the server if this file is run directly
if (import.meta.main) {
  startApiServer();
}
