import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { config } from "@farcaster-indexer/shared";
import { generateToken, verifyToken } from "../middleware/auth.js";

const authRoutes = new Hono();

// Login endpoint
authRoutes.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const { password } = body;

    if (!password) {
      return c.json({ error: "Password is required" }, 400);
    }

    // Verify admin password
    if (password !== config.auth.adminPassword) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    // Generate JWT token
    const token = generateToken("admin", "admin");

    // Set HTTP-only cookie
    setCookie(c, "token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    });

    return c.json({
      success: true,
      message: "Login successful",
      user: { id: "admin", role: "admin" },
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ error: "Login failed" }, 500);
  }
});

// Logout endpoint
authRoutes.post("/logout", async (c) => {
  try {
    // Clear authentication cookie
    deleteCookie(c, "token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      path: "/",
    });

    return c.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return c.json({ error: "Logout failed" }, 500);
  }
});

// Check authentication status
authRoutes.get("/status", async (c) => {
  try {
    const token = c.req.header("Cookie")?.match(/token=([^;]+)/)?.[1];

    if (!token) {
      return c.json({ authenticated: false });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return c.json({ authenticated: false });
    }

    return c.json({
      authenticated: true,
      user: { id: decoded.id, role: decoded.role },
    });
  } catch (error) {
    console.error("Auth status error:", error);
    return c.json({ authenticated: false });
  }
});

export { authRoutes };
