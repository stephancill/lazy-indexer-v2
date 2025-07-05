import type { Context, Next } from "hono";

// Input validation helpers
export const validateFid = (fid: any): number | null => {
  // Only accept strings and numbers
  if (typeof fid !== "string" && typeof fid !== "number") {
    return null;
  }

  // Convert to string for validation
  const fidStr = String(fid);

  // Check if it's a valid integer string (no decimals, no scientific notation)
  if (!/^\d+$/.test(fidStr)) {
    return null;
  }

  const parsed = Number.parseInt(fidStr, 10);

  // Check for valid range and safe integer
  if (isNaN(parsed) || parsed <= 0 || !Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
};

export const validatePagination = (limit?: string, offset?: string) => {
  const parsedLimit = Math.min(Number.parseInt(limit || "50"), 100);
  const parsedOffset = Math.max(Number.parseInt(offset || "0"), 0);

  return {
    limit: isNaN(parsedLimit) ? 50 : parsedLimit,
    offset: isNaN(parsedOffset) ? 0 : parsedOffset,
  };
};

export const validateSortOrder = (order?: string): "asc" | "desc" => {
  return order === "asc" ? "asc" : "desc";
};

export const validateDate = (dateString?: string): Date | null => {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
};

export const validateQueueName = (queueName?: string): string | null => {
  const validQueues = ["backfill", "realtime", "process-event"];
  if (!queueName || !validQueues.includes(queueName)) {
    return null;
  }
  return queueName;
};

// Validation middleware for common parameters
export const validateFidParam = async (c: Context, next: Next) => {
  const fid = validateFid(c.req.param("fid"));

  if (fid === null) {
    return c.json({ error: "Invalid FID parameter" }, 400);
  }

  // Store validated fid in context variables
  c.set("validatedFid" as any, fid);
  await next();
};

export const validateQueueParam = async (c: Context, next: Next) => {
  const queueName = validateQueueName(c.req.param("queue"));

  if (queueName === null) {
    return c.json(
      {
        error:
          "Invalid queue name. Must be one of: backfill, realtime, process-event",
      },
      400
    );
  }

  // Store validated queue name in context variables
  c.set("validatedQueue" as any, queueName);
  await next();
};

// Request body validation
export const validateTargetBody = (
  body: any
): { fid: number; isRoot?: boolean } | string => {
  if (!body || typeof body !== "object") {
    return "Request body is required";
  }

  const { fid, isRoot } = body;

  const validatedFid = validateFid(fid);
  if (validatedFid === null) {
    return "Valid FID is required";
  }

  return {
    fid: validatedFid,
    isRoot: isRoot === true, // Convert to boolean, default false
  };
};

export const validateClientTargetBody = (
  body: any
): { clientFid: number } | string => {
  if (!body || typeof body !== "object") {
    return "Request body is required";
  }

  const { clientFid } = body;

  const validatedFid = validateFid(clientFid);
  if (validatedFid === null) {
    return "Valid client FID is required";
  }

  return { clientFid: validatedFid };
};

export const validateTargetUpdateBody = (
  body: any
): { isRoot?: boolean } | string => {
  if (!body || typeof body !== "object") {
    return "Request body is required";
  }

  const { isRoot } = body;

  if (isRoot !== undefined && typeof isRoot !== "boolean") {
    return "isRoot must be a boolean value";
  }

  return { isRoot };
};

// Rate limiting helpers (for future implementation)
export const createRateLimiter = (windowMs: number, maxRequests: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return async (c: Context, next: Next) => {
    const clientId =
      c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;

    const clientData = requests.get(clientId);

    if (!clientData || clientData.resetTime <= now) {
      requests.set(clientId, { count: 1, resetTime: windowStart + windowMs });
    } else {
      clientData.count++;
      if (clientData.count > maxRequests) {
        return c.json(
          {
            error: "Rate limit exceeded",
            retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
          },
          429
        );
      }
    }

    await next();
  };
};

// Admin-specific rate limiter (more permissive than public API)
export const adminRateLimit = createRateLimiter(60000, 100); // 100 requests per minute
