import { Hono } from "hono";
import { db, schema } from "@farcaster-indexer/shared";
import { eq, desc, and, inArray, sql, asc } from "drizzle-orm";

const { casts, users, links, reactions } = schema;

const publicRoutes = new Hono();

// Get user profile
publicRoutes.get("/users/:fid", async (c) => {
  try {
    const fid = Number.parseInt(c.req.param("fid"));

    if (Number.isNaN(fid) || fid <= 0) {
      return c.json({ error: "Invalid FID" }, 400);
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.fid, fid))
      .limit(1)
      .then((results) => results[0] || null);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    // Get user stats
    const [castCount, followersCount, followingCount] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(casts)
        .where(eq(casts.fid, fid)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(links)
        .where(and(eq(links.targetFid, fid), eq(links.type, "follow"))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(links)
        .where(and(eq(links.fid, fid), eq(links.type, "follow"))),
    ]);

    return c.json({
      user: {
        ...user,
        stats: {
          casts: castCount[0]?.count || 0,
          followers: followersCount[0]?.count || 0,
          following: followingCount[0]?.count || 0,
        },
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return c.json({ error: "Failed to fetch user" }, 500);
  }
});

// Get cast by hash
publicRoutes.get("/casts/:hash", async (c) => {
  try {
    const hash = c.req.param("hash");

    if (!hash || hash.length !== 42) {
      return c.json({ error: "Invalid cast hash" }, 400);
    }

    const cast = await db
      .select({
        hash: casts.hash,
        fid: casts.fid,
        text: casts.text,
        parentHash: casts.parentHash,
        parentFid: casts.parentFid,
        parentUrl: casts.parentUrl,
        timestamp: casts.timestamp,
        embeds: casts.embeds,
        mentions: casts.mentions,
        mentionsPositions: casts.mentionsPositions,
        createdAt: casts.createdAt,
        // User fields
        username: users.username,
        displayName: users.displayName,
        pfpUrl: users.pfpUrl,
        bio: users.bio,
        custodyAddress: users.custodyAddress,
        syncedAt: users.syncedAt,
      })
      .from(casts)
      .leftJoin(users, eq(casts.fid, users.fid))
      .where(eq(casts.hash, hash))
      .limit(1)
      .then((results) => {
        if (results.length === 0) return null;
        const row = results[0];
        return {
          ...row,
          user: {
            fid: row.fid,
            username: row.username,
            displayName: row.displayName,
            pfpUrl: row.pfpUrl,
            bio: row.bio,
            custodyAddress: row.custodyAddress,
            syncedAt: row.syncedAt,
          },
        };
      });

    if (!cast) {
      return c.json({ error: "Cast not found" }, 404);
    }

    // Get cast stats
    const [likesCount, recastsCount, repliesCount] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(reactions)
        .where(and(eq(reactions.targetHash, hash), eq(reactions.type, "like"))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(reactions)
        .where(
          and(eq(reactions.targetHash, hash), eq(reactions.type, "recast"))
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(casts)
        .where(eq(casts.parentHash, hash)),
    ]);

    return c.json({
      cast: {
        ...cast,
        stats: {
          likes: likesCount[0]?.count || 0,
          recasts: recastsCount[0]?.count || 0,
          replies: repliesCount[0]?.count || 0,
        },
      },
    });
  } catch (error) {
    console.error("Get cast error:", error);
    return c.json({ error: "Failed to fetch cast" }, 500);
  }
});

// Get feed for a user (casts from users they follow)
publicRoutes.get("/feed/:fid", async (c) => {
  try {
    const fid = Number.parseInt(c.req.param("fid"));
    const limit = Math.min(Number.parseInt(c.req.query("limit") || "50"), 100);
    const offset = Math.max(Number.parseInt(c.req.query("offset") || "0"), 0);

    if (Number.isNaN(fid) || fid <= 0) {
      return c.json({ error: "Invalid FID" }, 400);
    }

    // Get list of users the FID follows
    const following = await db
      .select({ targetFid: links.targetFid })
      .from(links)
      .where(and(eq(links.fid, fid), eq(links.type, "follow")));

    if (following.length === 0) {
      return c.json({
        feed: [],
        pagination: { limit, offset, total: 0 },
      });
    }

    const followingFids = following.map((f) => f.targetFid);

    // Get casts from followed users
    const feedCasts = await db
      .select({
        hash: casts.hash,
        fid: casts.fid,
        text: casts.text,
        parentHash: casts.parentHash,
        parentFid: casts.parentFid,
        parentUrl: casts.parentUrl,
        timestamp: casts.timestamp,
        embeds: casts.embeds,
        mentions: casts.mentions,
        mentionsPositions: casts.mentionsPositions,
        createdAt: casts.createdAt,
        // User fields
        username: users.username,
        displayName: users.displayName,
        pfpUrl: users.pfpUrl,
        bio: users.bio,
        custodyAddress: users.custodyAddress,
        syncedAt: users.syncedAt,
      })
      .from(casts)
      .leftJoin(users, eq(casts.fid, users.fid))
      .where(inArray(casts.fid, followingFids))
      .orderBy(desc(casts.timestamp))
      .limit(limit)
      .offset(offset)
      .then((results) =>
        results.map((row) => ({
          ...row,
          user: {
            fid: row.fid,
            username: row.username,
            displayName: row.displayName,
            pfpUrl: row.pfpUrl,
            bio: row.bio,
            custodyAddress: row.custodyAddress,
            syncedAt: row.syncedAt,
          },
        }))
      );

    // Get total count for pagination
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(casts)
      .where(inArray(casts.fid, followingFids));

    return c.json({
      feed: feedCasts,
      pagination: {
        limit,
        offset,
        total: totalCount[0]?.count || 0,
        hasMore: offset + feedCasts.length < (totalCount[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error("Get feed error:", error);
    return c.json({ error: "Failed to fetch feed" }, 500);
  }
});

// Get user's casts
publicRoutes.get("/users/:fid/casts", async (c) => {
  try {
    const fid = Number.parseInt(c.req.param("fid"));
    const limit = Math.min(Number.parseInt(c.req.query("limit") || "50"), 100);
    const offset = Math.max(Number.parseInt(c.req.query("offset") || "0"), 0);

    if (Number.isNaN(fid) || fid <= 0) {
      return c.json({ error: "Invalid FID" }, 400);
    }

    const userCasts = await db
      .select({
        hash: casts.hash,
        fid: casts.fid,
        text: casts.text,
        parentHash: casts.parentHash,
        parentFid: casts.parentFid,
        parentUrl: casts.parentUrl,
        timestamp: casts.timestamp,
        embeds: casts.embeds,
        mentions: casts.mentions,
        mentionsPositions: casts.mentionsPositions,
        createdAt: casts.createdAt,
        // User fields
        username: users.username,
        displayName: users.displayName,
        pfpUrl: users.pfpUrl,
        bio: users.bio,
        custodyAddress: users.custodyAddress,
        syncedAt: users.syncedAt,
      })
      .from(casts)
      .leftJoin(users, eq(casts.fid, users.fid))
      .where(eq(casts.fid, fid))
      .orderBy(desc(casts.timestamp))
      .limit(limit)
      .offset(offset)
      .then((results) =>
        results.map((row) => ({
          ...row,
          user: {
            fid: row.fid,
            username: row.username,
            displayName: row.displayName,
            pfpUrl: row.pfpUrl,
            bio: row.bio,
            custodyAddress: row.custodyAddress,
            syncedAt: row.syncedAt,
          },
        }))
      );

    // Get total count for pagination
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(casts)
      .where(eq(casts.fid, fid));

    return c.json({
      casts: userCasts,
      pagination: {
        limit,
        offset,
        total: totalCount[0]?.count || 0,
        hasMore: offset + userCasts.length < (totalCount[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error("Get user casts error:", error);
    return c.json({ error: "Failed to fetch user casts" }, 500);
  }
});

// Get user's followers
publicRoutes.get("/users/:fid/followers", async (c) => {
  try {
    const fid = Number.parseInt(c.req.param("fid"));
    const limit = Math.min(Number.parseInt(c.req.query("limit") || "50"), 100);
    const offset = Math.max(Number.parseInt(c.req.query("offset") || "0"), 0);

    if (Number.isNaN(fid) || fid <= 0) {
      return c.json({ error: "Invalid FID" }, 400);
    }

    const followers = await db
      .select({
        hash: links.hash,
        fid: links.fid,
        targetFid: links.targetFid,
        type: links.type,
        timestamp: links.timestamp,
        createdAt: links.createdAt,
        // User fields for the follower (links.fid)
        username: users.username,
        displayName: users.displayName,
        pfpUrl: users.pfpUrl,
        bio: users.bio,
        custodyAddress: users.custodyAddress,
        syncedAt: users.syncedAt,
      })
      .from(links)
      .leftJoin(users, eq(links.fid, users.fid))
      .where(and(eq(links.targetFid, fid), eq(links.type, "follow")))
      .orderBy(desc(links.timestamp))
      .limit(limit)
      .offset(offset)
      .then((results) =>
        results.map((row) => ({
          ...row,
          user: {
            fid: row.fid,
            username: row.username,
            displayName: row.displayName,
            pfpUrl: row.pfpUrl,
            bio: row.bio,
            custodyAddress: row.custodyAddress,
            syncedAt: row.syncedAt,
          },
        }))
      );

    // Get total count for pagination
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(links)
      .where(and(eq(links.targetFid, fid), eq(links.type, "follow")));

    return c.json({
      followers: followers.map((f) => f.user),
      pagination: {
        limit,
        offset,
        total: totalCount[0]?.count || 0,
        hasMore: offset + followers.length < (totalCount[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error("Get followers error:", error);
    return c.json({ error: "Failed to fetch followers" }, 500);
  }
});

// Get user's following
publicRoutes.get("/users/:fid/following", async (c) => {
  try {
    const fid = Number.parseInt(c.req.param("fid"));
    const limit = Math.min(Number.parseInt(c.req.query("limit") || "50"), 100);
    const offset = Math.max(Number.parseInt(c.req.query("offset") || "0"), 0);

    if (Number.isNaN(fid) || fid <= 0) {
      return c.json({ error: "Invalid FID" }, 400);
    }

    const following = await db
      .select({
        hash: links.hash,
        fid: links.fid,
        targetFid: links.targetFid,
        type: links.type,
        timestamp: links.timestamp,
        createdAt: links.createdAt,
        // User fields for the target user (links.targetFid)
        username: users.username,
        displayName: users.displayName,
        pfpUrl: users.pfpUrl,
        bio: users.bio,
        custodyAddress: users.custodyAddress,
        syncedAt: users.syncedAt,
      })
      .from(links)
      .leftJoin(users, eq(links.targetFid, users.fid))
      .where(and(eq(links.fid, fid), eq(links.type, "follow")))
      .orderBy(desc(links.timestamp))
      .limit(limit)
      .offset(offset)
      .then((results) =>
        results.map((row) => ({
          ...row,
          targetUser: {
            fid: row.targetFid,
            username: row.username,
            displayName: row.displayName,
            pfpUrl: row.pfpUrl,
            bio: row.bio,
            custodyAddress: row.custodyAddress,
            syncedAt: row.syncedAt,
          },
        }))
      );

    // Get total count for pagination
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(links)
      .where(and(eq(links.fid, fid), eq(links.type, "follow")));

    return c.json({
      following: following.map((f) => f.targetUser),
      pagination: {
        limit,
        offset,
        total: totalCount[0]?.count || 0,
        hasMore: offset + following.length < (totalCount[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error("Get following error:", error);
    return c.json({ error: "Failed to fetch following" }, 500);
  }
});

// Get trending casts (by reactions in last 24 hours)
publicRoutes.get("/trending", async (c) => {
  try {
    const limit = Math.min(Number.parseInt(c.req.query("limit") || "50"), 100);
    const offset = Math.max(Number.parseInt(c.req.query("offset") || "0"), 0);

    // Get casts with reaction counts from last 24 hours
    const trendingCasts = await db
      .select({
        hash: casts.hash,
        fid: casts.fid,
        text: casts.text,
        timestamp: casts.timestamp,
        parentHash: casts.parentHash,
        parentFid: casts.parentFid,
        parentUrl: casts.parentUrl,
        embeds: casts.embeds,
        reactionCount: sql<number>`count(${reactions.hash})`,
      })
      .from(casts)
      .leftJoin(reactions, eq(reactions.targetHash, casts.hash))
      .where(sql`${casts.timestamp} > NOW() - INTERVAL '24 hours'`)
      .groupBy(casts.hash)
      .orderBy(desc(sql`count(${reactions.hash})`))
      .limit(limit)
      .offset(offset);

    // Get user info for each cast
    const castHashes = trendingCasts.map((c) => c.hash);
    const castsWithUsers = await db
      .select({
        hash: casts.hash,
        fid: casts.fid,
        // User fields
        username: users.username,
        displayName: users.displayName,
        pfpUrl: users.pfpUrl,
        bio: users.bio,
        custodyAddress: users.custodyAddress,
        syncedAt: users.syncedAt,
      })
      .from(casts)
      .leftJoin(users, eq(casts.fid, users.fid))
      .where(inArray(casts.hash, castHashes))
      .then((results) =>
        results.map((row) => ({
          hash: row.hash,
          fid: row.fid,
          user: {
            fid: row.fid,
            username: row.username,
            displayName: row.displayName,
            pfpUrl: row.pfpUrl,
            bio: row.bio,
            custodyAddress: row.custodyAddress,
            syncedAt: row.syncedAt,
          },
        }))
      );

    // Merge reaction counts with user info
    const enrichedCasts = trendingCasts.map((trendingCast) => {
      const castWithUser = castsWithUsers.find(
        (c) => c.hash === trendingCast.hash
      );
      return {
        ...trendingCast,
        user: castWithUser?.user,
        stats: {
          reactions: trendingCast.reactionCount,
        },
      };
    });

    return c.json({
      trending: enrichedCasts,
      pagination: {
        limit,
        offset,
        total: enrichedCasts.length,
      },
    });
  } catch (error) {
    console.error("Get trending error:", error);
    return c.json({ error: "Failed to fetch trending casts" }, 500);
  }
});

export { publicRoutes };
