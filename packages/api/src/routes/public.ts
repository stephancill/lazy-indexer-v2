import { Hono } from "hono";
import { db, schema } from "@farcaster-indexer/shared";
import { eq, desc, and, inArray, sql, asc, ilike, or } from "drizzle-orm";

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
      .where(and(eq(casts.fid, fid), sql`${casts.parentHash} IS NULL`))
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
      .where(and(eq(casts.fid, fid), sql`${casts.parentHash} IS NULL`));

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

// Get user's replies (casts with parentHash)
publicRoutes.get("/users/:fid/replies", async (c) => {
  try {
    const fid = Number.parseInt(c.req.param("fid"));
    const limit = Math.min(Number.parseInt(c.req.query("limit") || "50"), 100);
    const offset = Math.max(Number.parseInt(c.req.query("offset") || "0"), 0);

    if (Number.isNaN(fid) || fid <= 0) {
      return c.json({ error: "Invalid FID" }, 400);
    }

    const userReplies = await db
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
      .where(and(eq(casts.fid, fid), sql`${casts.parentHash} IS NOT NULL`))
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
      .where(and(eq(casts.fid, fid), sql`${casts.parentHash} IS NOT NULL`));

    return c.json({
      replies: userReplies,
      pagination: {
        limit,
        offset,
        total: totalCount[0]?.count || 0,
        hasMore: offset + userReplies.length < (totalCount[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error("Get user replies error:", error);
    return c.json({ error: "Failed to fetch user replies" }, 500);
  }
});

// Get user's likes (reactions by user)
publicRoutes.get("/users/:fid/likes", async (c) => {
  try {
    const fid = Number.parseInt(c.req.param("fid"));
    const limit = Math.min(Number.parseInt(c.req.query("limit") || "50"), 100);
    const offset = Math.max(Number.parseInt(c.req.query("offset") || "0"), 0);

    if (Number.isNaN(fid) || fid <= 0) {
      return c.json({ error: "Invalid FID" }, 400);
    }

    const userLikes = await db
      .select({
        hash: reactions.hash,
        fid: reactions.fid,
        type: reactions.type,
        targetHash: reactions.targetHash,
        timestamp: reactions.timestamp,
        createdAt: reactions.createdAt,
        // Cast fields
        castHash: casts.hash,
        castFid: casts.fid,
        castText: casts.text,
        castParentHash: casts.parentHash,
        castParentFid: casts.parentFid,
        castParentUrl: casts.parentUrl,
        castTimestamp: casts.timestamp,
        castEmbeds: casts.embeds,
        castMentions: casts.mentions,
        castMentionsPositions: casts.mentionsPositions,
        castCreatedAt: casts.createdAt,
        // User fields for the cast author
        castUsername: users.username,
        castDisplayName: users.displayName,
        castPfpUrl: users.pfpUrl,
        castBio: users.bio,
        castCustodyAddress: users.custodyAddress,
        castSyncedAt: users.syncedAt,
      })
      .from(reactions)
      .leftJoin(casts, eq(reactions.targetHash, casts.hash))
      .leftJoin(users, eq(casts.fid, users.fid))
      .where(and(eq(reactions.fid, fid), eq(reactions.type, "like")))
      .orderBy(desc(reactions.timestamp))
      .limit(limit)
      .offset(offset)
      .then((results) =>
        results.map((row) => ({
          reaction: {
            hash: row.hash,
            fid: row.fid,
            type: row.type,
            targetHash: row.targetHash,
            timestamp: row.timestamp,
            createdAt: row.createdAt,
          },
          cast: row.castHash
            ? {
                hash: row.castHash,
                fid: row.castFid,
                text: row.castText,
                parentHash: row.castParentHash,
                parentFid: row.castParentFid,
                parentUrl: row.castParentUrl,
                timestamp: row.castTimestamp,
                embeds: row.castEmbeds,
                mentions: row.castMentions,
                mentionsPositions: row.castMentionsPositions,
                createdAt: row.castCreatedAt,
                user: {
                  fid: row.castFid,
                  username: row.castUsername,
                  displayName: row.castDisplayName,
                  pfpUrl: row.castPfpUrl,
                  bio: row.castBio,
                  custodyAddress: row.castCustodyAddress,
                  syncedAt: row.castSyncedAt,
                },
              }
            : null,
        }))
      );

    // Get total count for pagination
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(reactions)
      .where(and(eq(reactions.fid, fid), eq(reactions.type, "like")));

    return c.json({
      likes: userLikes,
      pagination: {
        limit,
        offset,
        total: totalCount[0]?.count || 0,
        hasMore: offset + userLikes.length < (totalCount[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error("Get user likes error:", error);
    return c.json({ error: "Failed to fetch user likes" }, 500);
  }
});

// Get trending casts (by reactions in last 24 hours)
publicRoutes.get("/trending", async (c) => {
  try {
    const limit = Math.min(Number.parseInt(c.req.query("limit") || "50"), 100);
    const offset = Math.max(Number.parseInt(c.req.query("offset") || "0"), 0);

    // Get casts with reaction counts from last 7 days (extended for demo)
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
      .where(sql`${casts.timestamp} > NOW() - INTERVAL '7 days'`)
      .groupBy(casts.hash)
      .orderBy(desc(sql`count(${reactions.hash})`), desc(casts.timestamp))
      .limit(limit)
      .offset(offset);

    // Get user info for each cast
    const castHashes = trendingCasts.map((c) => c.hash);
    let castsWithUsers: any[] = [];

    if (castHashes.length > 0) {
      castsWithUsers = await db
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
    }

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

    // Get total count for pagination
    const totalCount = await db
      .select({ count: sql<number>`count(DISTINCT ${casts.hash})` })
      .from(casts)
      .leftJoin(reactions, eq(reactions.targetHash, casts.hash))
      .where(sql`${casts.timestamp} > NOW() - INTERVAL '7 days'`);

    return c.json({
      trending: enrichedCasts,
      pagination: {
        limit,
        offset,
        total: totalCount[0]?.count || 0,
        hasMore: offset + enrichedCasts.length < (totalCount[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error("Get trending error:", error);
    return c.json({ error: "Failed to fetch trending casts" }, 500);
  }
});

// Universal search endpoint
publicRoutes.get("/search", async (c) => {
  try {
    const query = c.req.query("q")?.trim();
    const limit = Math.min(Number.parseInt(c.req.query("limit") || "20"), 100);
    const offset = Math.max(Number.parseInt(c.req.query("offset") || "0"), 0);

    if (!query) {
      return c.json({ error: "Search query is required" }, 400);
    }

    // Search users by username, display name, or bio
    const userResults = await db
      .select({
        fid: users.fid,
        username: users.username,
        displayName: users.displayName,
        pfpUrl: users.pfpUrl,
        bio: users.bio,
        custodyAddress: users.custodyAddress,
        syncedAt: users.syncedAt,
      })
      .from(users)
      .where(
        or(
          ilike(users.username, `%${query}%`),
          ilike(users.displayName, `%${query}%`),
          ilike(users.bio, `%${query}%`)
        )
      )
      .orderBy(desc(users.syncedAt))
      .limit(Math.min(limit, 10)); // Limit users to 10 per search

    // Search casts by text content
    const castResults = await db
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
      .where(ilike(casts.text, `%${query}%`))
      .orderBy(desc(casts.timestamp))
      .limit(Math.min(limit, 20)) // Limit casts to 20 per search
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

    // Get counts for each category
    const [userCount, castCount] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(
          or(
            ilike(users.username, `%${query}%`),
            ilike(users.displayName, `%${query}%`),
            ilike(users.bio, `%${query}%`)
          )
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(casts)
        .where(ilike(casts.text, `%${query}%`)),
    ]);

    const totalCount =
      Number(userCount[0]?.count || 0) + Number(castCount[0]?.count || 0);

    return c.json({
      query,
      results: {
        users: userResults,
        casts: castResults,
      },
      counts: {
        users: userCount[0]?.count || 0,
        casts: castCount[0]?.count || 0,
        total: totalCount,
      },
      pagination: {
        limit,
        offset,
        hasMore:
          userResults.length === Math.min(limit, 10) ||
          castResults.length === Math.min(limit, 20),
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

export { publicRoutes };
