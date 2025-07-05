import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import jwt from "jsonwebtoken";
import { config } from "@farcaster-indexer/shared";

export interface AuthContext {
  user: {
    id: string;
    role: "admin";
    iat: number;
    exp: number;
  };
}

export const authMiddleware = async (c: Context, next: Next) => {
  try {
    // Get JWT token from HTTP-only cookie
    const token = getCookie(c, "token");

    if (!token) {
      return c.json({ error: "Authentication required" }, 401);
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.auth.jwtSecret) as jwt.JwtPayload;

    if (!decoded || typeof decoded !== "object" || !decoded.id) {
      return c.json({ error: "Invalid token" }, 401);
    }

    // Check if token is expired
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      return c.json({ error: "Token expired" }, 401);
    }

    // Add user info to context
    c.set("user", decoded);

    await next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return c.json({ error: "Invalid token" }, 401);
    }
    if (error instanceof jwt.TokenExpiredError) {
      return c.json({ error: "Token expired" }, 401);
    }

    console.error("Auth middleware error:", error);
    return c.json({ error: "Authentication failed" }, 401);
  }
};

export const generateToken = (
  userId: string,
  role: "admin" = "admin"
): string => {
  return jwt.sign(
    {
      id: userId,
      role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    },
    config.auth.jwtSecret
  );
};

export const verifyToken = (token: string): jwt.JwtPayload | null => {
  try {
    return jwt.verify(token, config.auth.jwtSecret) as jwt.JwtPayload;
  } catch (_error) {
    return null;
  }
};
