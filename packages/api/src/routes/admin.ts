import { Hono } from 'hono';
import { db, schema } from '@farcaster-indexer/shared';
import { eq, desc, and, sql, asc, ilike, or } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';

const { targets, targetClients, casts, users, links, reactions } = schema;

const adminRoutes = new Hono();

// Apply auth middleware to all admin routes
adminRoutes.use('*', authMiddleware);

// Get all targets with pagination and filtering
adminRoutes.get('/targets', async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = Math.max(parseInt(c.req.query('offset') || '0'), 0);
    const search = c.req.query('search') || '';
    const isRoot = c.req.query('is_root');
    const sortBy = c.req.query('sort_by') || 'added_at';
    const sortOrder = c.req.query('sort_order') || 'desc';

    let whereClause = undefined;
    if (search) {
      whereClause = sql`${targets.fid}::text ILIKE ${'%' + search + '%'}`;
    }
    if (isRoot !== undefined) {
      const rootFilter = eq(targets.isRoot, isRoot === 'true');
      whereClause = whereClause ? and(whereClause, rootFilter) : rootFilter;
    }

    const orderBy = sortOrder === 'asc' ? asc : desc;
    const sortColumn = sortBy === 'fid' ? targets.fid : targets.addedAt;

    const allTargets = await db.query.targets.findMany({
      where: whereClause,
      orderBy: [orderBy(sortColumn)],
      limit: limit,
      offset: offset,
    });

    // Get total count
    const totalCount = await db.select({ count: sql<number>`count(*)` })
      .from(targets)
      .where(whereClause);

    return c.json({
      targets: allTargets,
      pagination: {
        limit,
        offset,
        total: totalCount[0]?.count || 0,
        hasMore: offset + allTargets.length < (totalCount[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error('Get targets error:', error);
    return c.json({ error: 'Failed to fetch targets' }, 500);
  }
});

// Add new target
adminRoutes.post('/targets', async (c) => {
  try {
    const body = await c.req.json();
    const { fid, isRoot = false } = body;

    if (!fid || !Number.isInteger(fid) || fid <= 0) {
      return c.json({ error: 'Valid FID is required' }, 400);
    }

    // Check if target already exists
    const existingTarget = await db.query.targets.findFirst({
      where: eq(targets.fid, fid),
    });

    if (existingTarget) {
      return c.json({ error: 'Target already exists' }, 409);
    }

    // Add target to database
    const newTarget = await db.insert(targets).values({
      fid,
      isRoot,
      addedAt: new Date(),
    }).returning();

    // TODO: Add to Redis cache and trigger backfill job

    return c.json({ target: newTarget[0] }, 201);
  } catch (error) {
    console.error('Add target error:', error);
    return c.json({ error: 'Failed to add target' }, 500);
  }
});

// Update target properties
adminRoutes.put('/targets/:fid', async (c) => {
  try {
    const fid = parseInt(c.req.param('fid'));
    const body = await c.req.json();
    const { isRoot } = body;

    if (isNaN(fid) || fid <= 0) {
      return c.json({ error: 'Invalid FID' }, 400);
    }

    const target = await db.query.targets.findFirst({
      where: eq(targets.fid, fid),
    });

    if (!target) {
      return c.json({ error: 'Target not found' }, 404);
    }

    // Update target
    const updatedTarget = await db.update(targets)
      .set({ isRoot })
      .where(eq(targets.fid, fid))
      .returning();

    // TODO: Update Redis cache

    return c.json({ target: updatedTarget[0] });
  } catch (error) {
    console.error('Update target error:', error);
    return c.json({ error: 'Failed to update target' }, 500);
  }
});

// Remove target
adminRoutes.delete('/targets/:fid', async (c) => {
  try {
    const fid = parseInt(c.req.param('fid'));

    if (isNaN(fid) || fid <= 0) {
      return c.json({ error: 'Invalid FID' }, 400);
    }

    const target = await db.query.targets.findFirst({
      where: eq(targets.fid, fid),
    });

    if (!target) {
      return c.json({ error: 'Target not found' }, 404);
    }

    // Remove from database
    await db.delete(targets).where(eq(targets.fid, fid));

    // TODO: Remove from Redis cache and clean up historical data

    return c.json({ success: true });
  } catch (error) {
    console.error('Remove target error:', error);
    return c.json({ error: 'Failed to remove target' }, 500);
  }
});

// Get target statistics
adminRoutes.get('/targets/:fid/stats', async (c) => {
  try {
    const fid = parseInt(c.req.param('fid'));

    if (isNaN(fid) || fid <= 0) {
      return c.json({ error: 'Invalid FID' }, 400);
    }

    const target = await db.query.targets.findFirst({
      where: eq(targets.fid, fid),
    });

    if (!target) {
      return c.json({ error: 'Target not found' }, 404);
    }

    // Get comprehensive stats
    const [castCount, followerCount, followingCount, reactionCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(casts)
        .where(eq(casts.fid, fid)),
      db.select({ count: sql<number>`count(*)` })
        .from(links)
        .where(and(eq(links.targetFid, fid), eq(links.type, 'follow'))),
      db.select({ count: sql<number>`count(*)` })
        .from(links)
        .where(and(eq(links.fid, fid), eq(links.type, 'follow'))),
      db.select({ count: sql<number>`count(*)` })
        .from(reactions)
        .where(eq(reactions.fid, fid)),
    ]);

    return c.json({
      target,
      stats: {
        casts: castCount[0]?.count || 0,
        followers: followerCount[0]?.count || 0,
        following: followingCount[0]?.count || 0,
        reactions: reactionCount[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error('Get target stats error:', error);
    return c.json({ error: 'Failed to fetch target stats' }, 500);
  }
});

// Trigger backfill for specific target
adminRoutes.post('/targets/:fid/backfill', async (c) => {
  try {
    const fid = parseInt(c.req.param('fid'));

    if (isNaN(fid) || fid <= 0) {
      return c.json({ error: 'Invalid FID' }, 400);
    }

    const target = await db.query.targets.findFirst({
      where: eq(targets.fid, fid),
    });

    if (!target) {
      return c.json({ error: 'Target not found' }, 404);
    }

    // TODO: Queue backfill job for this target

    return c.json({ 
      success: true, 
      message: `Backfill job queued for FID ${fid}` 
    });
  } catch (error) {
    console.error('Trigger backfill error:', error);
    return c.json({ error: 'Failed to trigger backfill' }, 500);
  }
});

// Get all client targets
adminRoutes.get('/client-targets', async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = Math.max(parseInt(c.req.query('offset') || '0'), 0);

    const clientTargets = await db.query.targetClients.findMany({
      orderBy: [desc(targetClients.addedAt)],
      limit: limit,
      offset: offset,
    });

    const totalCount = await db.select({ count: sql<number>`count(*)` })
      .from(targetClients);

    return c.json({
      clientTargets,
      pagination: {
        limit,
        offset,
        total: totalCount[0]?.count || 0,
        hasMore: offset + clientTargets.length < (totalCount[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error('Get client targets error:', error);
    return c.json({ error: 'Failed to fetch client targets' }, 500);
  }
});

// Add new client target
adminRoutes.post('/client-targets', async (c) => {
  try {
    const body = await c.req.json();
    const { clientFid } = body;

    if (!clientFid || !Number.isInteger(clientFid) || clientFid <= 0) {
      return c.json({ error: 'Valid client FID is required' }, 400);
    }

    // Check if client target already exists
    const existingClient = await db.query.targetClients.findFirst({
      where: eq(targetClients.clientFid, clientFid),
    });

    if (existingClient) {
      return c.json({ error: 'Client target already exists' }, 409);
    }

    // Add client target to database
    const newClient = await db.insert(targetClients).values({
      clientFid,
      addedAt: new Date(),
    }).returning();

    // TODO: Add to Redis cache

    return c.json({ clientTarget: newClient[0] }, 201);
  } catch (error) {
    console.error('Add client target error:', error);
    return c.json({ error: 'Failed to add client target' }, 500);
  }
});

// Remove client target
adminRoutes.delete('/client-targets/:fid', async (c) => {
  try {
    const clientFid = parseInt(c.req.param('fid'));

    if (isNaN(clientFid) || clientFid <= 0) {
      return c.json({ error: 'Invalid client FID' }, 400);
    }

    const client = await db.query.targetClients.findFirst({
      where: eq(targetClients.clientFid, clientFid),
    });

    if (!client) {
      return c.json({ error: 'Client target not found' }, 404);
    }

    // Remove from database
    await db.delete(targetClients).where(eq(targetClients.clientFid, clientFid));

    // TODO: Remove from Redis cache

    return c.json({ success: true });
  } catch (error) {
    console.error('Remove client target error:', error);
    return c.json({ error: 'Failed to remove client target' }, 500);
  }
});

// Get job status and queue statistics
adminRoutes.get('/jobs', async (c) => {
  try {
    // TODO: Get actual job queue statistics from BullMQ
    const mockStats = {
      backfillQueue: {
        active: 0,
        waiting: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      },
      realtimeQueue: {
        active: 1,
        waiting: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      },
    };

    return c.json({ jobs: mockStats });
  } catch (error) {
    console.error('Get jobs error:', error);
    return c.json({ error: 'Failed to fetch job status' }, 500);
  }
});

// Trigger full backfill for all unsynced targets
adminRoutes.post('/jobs/backfill', async (c) => {
  try {
    // Get all targets that haven't been synced
    const unsyncedTargets = await db.query.targets.findMany({
      where: sql`${targets.lastSyncedAt} IS NULL`,
    });

    // TODO: Queue backfill jobs for all unsynced targets

    return c.json({ 
      success: true, 
      message: `Backfill jobs queued for ${unsyncedTargets.length} targets` 
    });
  } catch (error) {
    console.error('Trigger backfill error:', error);
    return c.json({ error: 'Failed to trigger backfill' }, 500);
  }
});

// Get system statistics
adminRoutes.get('/stats', async (c) => {
  try {
    const [
      totalTargets,
      rootTargets,
      clientTargets,
      totalCasts,
      totalUsers,
      totalReactions,
      totalLinks,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(targets),
      db.select({ count: sql<number>`count(*)` }).from(targets).where(eq(targets.isRoot, true)),
      db.select({ count: sql<number>`count(*)` }).from(targetClients),
      db.select({ count: sql<number>`count(*)` }).from(casts),
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(reactions),
      db.select({ count: sql<number>`count(*)` }).from(links),
    ]);

    return c.json({
      stats: {
        targets: {
          total: totalTargets[0]?.count || 0,
          root: rootTargets[0]?.count || 0,
          clients: clientTargets[0]?.count || 0,
        },
        data: {
          casts: totalCasts[0]?.count || 0,
          users: totalUsers[0]?.count || 0,
          reactions: totalReactions[0]?.count || 0,
          links: totalLinks[0]?.count || 0,
        },
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return c.json({ error: 'Failed to fetch system stats' }, 500);
  }
});

export { adminRoutes };