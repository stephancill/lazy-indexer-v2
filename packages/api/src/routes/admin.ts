import { Hono } from 'hono';
import { db, schema } from '@farcaster-indexer/shared';
import { eq, desc, and, sql, asc, ilike, or } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { 
  validateFid,
  validateQueueName,
  validateTargetBody,
  validateClientTargetBody,
  validateTargetUpdateBody,
  validatePagination,
  validateSortOrder,
  validateDate,
  adminRateLimit
} from '../middleware/validation.js';
import { 
  scheduleBackfillJob, 
  getAllQueueStats, 
  getQueueStats,
  addTargetToSet,
  removeTargetFromSet,
  addClientTargetToSet,
  removeClientTargetFromSet,
  pauseQueue,
  resumeQueue,
  clearQueue
} from '@farcaster-indexer/indexer';

const { targets, targetClients, casts, users, links, reactions } = schema;

const adminRoutes = new Hono();

// Apply auth middleware and rate limiting to all admin routes
adminRoutes.use('*', authMiddleware);
adminRoutes.use('*', adminRateLimit);

// Get all targets with pagination and filtering
adminRoutes.get('/targets', async (c) => {
  try {
    // Validate and parse query parameters
    const { limit, offset } = validatePagination(c.req.query('limit'), c.req.query('offset'));
    const search = c.req.query('search') || '';
    const isRoot = c.req.query('is_root');
    const syncStatus = c.req.query('sync_status'); // 'synced', 'unsynced', 'all'
    const sortBy = c.req.query('sort_by') || 'added_at';
    const sortOrder = validateSortOrder(c.req.query('sort_order'));
    const dateFrom = validateDate(c.req.query('date_from'));
    const dateTo = validateDate(c.req.query('date_to'));
    
    // Validate date range
    if (dateFrom && dateTo && dateFrom > dateTo) {
      return c.json({ error: 'dateFrom cannot be later than dateTo' }, 400);
    }

    let whereClause = undefined;
    
    // Text search on FID
    if (search) {
      whereClause = sql`${targets.fid}::text ILIKE ${'%' + search + '%'}`;
    }
    
    // Filter by root status
    if (isRoot !== undefined) {
      const rootFilter = eq(targets.isRoot, isRoot === 'true');
      whereClause = whereClause ? and(whereClause, rootFilter) : rootFilter;
    }
    
    // Filter by sync status
    if (syncStatus && syncStatus !== 'all') {
      const syncFilter = syncStatus === 'synced' 
        ? sql`${targets.lastSyncedAt} IS NOT NULL`
        : sql`${targets.lastSyncedAt} IS NULL`;
      whereClause = whereClause ? and(whereClause, syncFilter) : syncFilter;
    }
    
    // Date range filtering
    if (dateFrom) {
      const dateFilter = sql`${targets.addedAt} >= ${dateFrom}`;
      whereClause = whereClause ? and(whereClause, dateFilter) : dateFilter;
    }
    
    if (dateTo) {
      const dateFilter = sql`${targets.addedAt} <= ${dateTo}`;
      whereClause = whereClause ? and(whereClause, dateFilter) : dateFilter;
    }

    // Sorting
    const orderBy = sortOrder === 'asc' ? asc : desc;
    let sortColumn;
    switch (sortBy) {
      case 'fid':
        sortColumn = targets.fid;
        break;
      case 'last_synced_at':
        sortColumn = targets.lastSyncedAt;
        break;
      default:
        sortColumn = targets.addedAt;
    }

    const allTargets = await db.query.targets.findMany({
      where: whereClause,
      orderBy: [orderBy(sortColumn)],
      limit: limit,
      offset: offset,
    });

    // Get total count for pagination
    const totalCount = await db.select({ count: sql<number>`count(*)` })
      .from(targets)
      .where(whereClause);

    // Get aggregated statistics for the filtered set
    const [syncedCount, unsyncedCount, rootCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(targets)
        .where(whereClause ? and(whereClause, sql`${targets.lastSyncedAt} IS NOT NULL`) : sql`${targets.lastSyncedAt} IS NOT NULL`),
      db.select({ count: sql<number>`count(*)` })
        .from(targets)
        .where(whereClause ? and(whereClause, sql`${targets.lastSyncedAt} IS NULL`) : sql`${targets.lastSyncedAt} IS NULL`),
      db.select({ count: sql<number>`count(*)` })
        .from(targets)
        .where(whereClause ? and(whereClause, eq(targets.isRoot, true)) : eq(targets.isRoot, true)),
    ]);

    return c.json({
      targets: allTargets,
      pagination: {
        limit,
        offset,
        total: totalCount[0]?.count || 0,
        hasMore: offset + allTargets.length < (totalCount[0]?.count || 0),
      },
      summary: {
        total: totalCount[0]?.count || 0,
        synced: syncedCount[0]?.count || 0,
        unsynced: unsyncedCount[0]?.count || 0,
        root: rootCount[0]?.count || 0,
      },
      filters: {
        search,
        isRoot,
        syncStatus,
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString(),
        sortBy,
        sortOrder,
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
    const validation = validateTargetBody(body);
    
    if (typeof validation === 'string') {
      return c.json({ error: validation }, 400);
    }
    
    const { fid, isRoot = false } = validation;

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

    // Add to Redis cache
    await addTargetToSet(fid);

    // Trigger backfill job
    await scheduleBackfillJob(fid, isRoot);

    return c.json({ 
      target: newTarget[0],
      message: 'Target added and backfill job scheduled'
    }, 201);
  } catch (error) {
    console.error('Add target error:', error);
    return c.json({ error: 'Failed to add target' }, 500);
  }
});

// Update target properties
adminRoutes.put('/targets/:fid', async (c) => {
  try {
    const fid = validateFid(c.req.param('fid'));
    
    if (fid === null) {
      return c.json({ error: 'Invalid FID' }, 400);
    }
    
    const body = await c.req.json();
    const validation = validateTargetUpdateBody(body);
    
    if (typeof validation === 'string') {
      return c.json({ error: validation }, 400);
    }
    
    const { isRoot } = validation;

    const target = await db.query.targets.findFirst({
      where: eq(targets.fid, fid),
    });

    if (!target) {
      return c.json({ error: 'Target not found' }, 404);
    }

    // Update target (only if isRoot is provided)
    const updateData: any = {};
    if (isRoot !== undefined) {
      updateData.isRoot = isRoot;
    }
    
    const updatedTarget = await db.update(targets)
      .set(updateData)
      .where(eq(targets.fid, fid))
      .returning();

    // Redis cache doesn't need update for isRoot changes
    // (target FID remains in the set)

    return c.json({ 
      target: updatedTarget[0],
      message: 'Target updated successfully'
    });
  } catch (error) {
    console.error('Update target error:', error);
    return c.json({ error: 'Failed to update target' }, 500);
  }
});

// Remove target
adminRoutes.delete('/targets/:fid', async (c) => {
  try {
    const fid = validateFid(c.req.param('fid'));
    
    if (fid === null) {
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

    // Remove from Redis cache
    await removeTargetFromSet(fid);

    // Note: Historical data cleanup can be handled by a separate cleanup job
    // to avoid blocking the API response

    return c.json({ 
      success: true,
      message: 'Target removed successfully'
    });
  } catch (error) {
    console.error('Remove target error:', error);
    return c.json({ error: 'Failed to remove target' }, 500);
  }
});

// Get target statistics
adminRoutes.get('/targets/:fid/stats', async (c) => {
  try {
    const fid = validateFid(c.req.param('fid'));
    
    if (fid === null) {
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
    const fid = validateFid(c.req.param('fid'));
    
    if (fid === null) {
      return c.json({ error: 'Invalid FID' }, 400);
    }

    const target = await db.query.targets.findFirst({
      where: eq(targets.fid, fid),
    });

    if (!target) {
      return c.json({ error: 'Target not found' }, 404);
    }

    // Queue backfill job for this target
    await scheduleBackfillJob(fid, target.isRoot);

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
    const validation = validateClientTargetBody(body);
    
    if (typeof validation === 'string') {
      return c.json({ error: validation }, 400);
    }
    
    const { clientFid } = validation;

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

    // Add to Redis cache
    await addClientTargetToSet(clientFid);

    return c.json({ 
      clientTarget: newClient[0],
      message: 'Client target added successfully'
    }, 201);
  } catch (error) {
    console.error('Add client target error:', error);
    return c.json({ error: 'Failed to add client target' }, 500);
  }
});

// Remove client target
adminRoutes.delete('/client-targets/:fid', async (c) => {
  try {
    const clientFid = validateFid(c.req.param('fid'));
    
    if (clientFid === null) {
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

    // Remove from Redis cache
    await removeClientTargetFromSet(clientFid);

    return c.json({ 
      success: true,
      message: 'Client target removed successfully'
    });
  } catch (error) {
    console.error('Remove client target error:', error);
    return c.json({ error: 'Failed to remove client target' }, 500);
  }
});

// Get job status and queue statistics
adminRoutes.get('/jobs', async (c) => {
  try {
    // Get actual job queue statistics from BullMQ
    const stats = await getAllQueueStats();
    
    // Transform into a more structured format
    const jobStats = stats.reduce((acc, stat) => {
      acc[stat.queue + 'Queue'] = {
        active: stat.active,
        waiting: stat.waiting,
        completed: stat.completed,
        failed: stat.failed,
        delayed: stat.delayed,
        paused: stat.paused,
      };
      return acc;
    }, {} as Record<string, any>);

    return c.json({ 
      jobs: jobStats,
      timestamp: new Date().toISOString()
    });
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

    // Queue backfill jobs for all unsynced targets
    const jobs = await Promise.all(
      unsyncedTargets.map(target => scheduleBackfillJob(target.fid, target.isRoot))
    );

    return c.json({ 
      success: true, 
      message: `Backfill jobs queued for ${unsyncedTargets.length} targets`,
      queuedJobs: jobs.length
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

// Queue management endpoints
adminRoutes.post('/jobs/pause/:queue', async (c) => {
  try {
    const queueName = validateQueueName(c.req.param('queue'));
    
    if (queueName === null) {
      return c.json({ error: 'Invalid queue name' }, 400);
    }
    
    await pauseQueue(queueName);
    
    return c.json({ 
      success: true, 
      message: `Queue ${queueName} paused successfully` 
    });
  } catch (error) {
    console.error('Pause queue error:', error);
    return c.json({ error: 'Failed to pause queue' }, 500);
  }
});

adminRoutes.post('/jobs/resume/:queue', async (c) => {
  try {
    const queueName = validateQueueName(c.req.param('queue'));
    
    if (queueName === null) {
      return c.json({ error: 'Invalid queue name' }, 400);
    }
    
    await resumeQueue(queueName);
    
    return c.json({ 
      success: true, 
      message: `Queue ${queueName} resumed successfully` 
    });
  } catch (error) {
    console.error('Resume queue error:', error);
    return c.json({ error: 'Failed to resume queue' }, 500);
  }
});

adminRoutes.post('/jobs/clear/:queue', async (c) => {
  try {
    const queueName = validateQueueName(c.req.param('queue'));
    
    if (queueName === null) {
      return c.json({ error: 'Invalid queue name' }, 400);
    }
    
    await clearQueue(queueName);
    
    return c.json({ 
      success: true, 
      message: `Queue ${queueName} cleared successfully` 
    });
  } catch (error) {
    console.error('Clear queue error:', error);
    return c.json({ error: 'Failed to clear queue' }, 500);
  }
});

// Get detailed statistics for a specific queue
adminRoutes.get('/jobs/:queue/stats', async (c) => {
  try {
    const queueName = validateQueueName(c.req.param('queue'));
    
    if (queueName === null) {
      return c.json({ error: 'Invalid queue name' }, 400);
    }
    
    const stats = await getQueueStats(queueName);
    
    if (!stats) {
      return c.json({ error: 'Queue not found' }, 404);
    }
    
    return c.json({ 
      queue: queueName,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get queue stats error:', error);
    return c.json({ error: 'Failed to fetch queue stats' }, 500);
  }
});

// Enhanced system statistics with real-time data
adminRoutes.get('/stats/realtime', async (c) => {
  try {
    const [
      totalTargets,
      rootTargets,
      clientTargets,
      totalCasts,
      totalUsers,
      totalReactions,
      totalLinks,
      unsyncedTargets,
      queueStats,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(targets),
      db.select({ count: sql<number>`count(*)` }).from(targets).where(eq(targets.isRoot, true)),
      db.select({ count: sql<number>`count(*)` }).from(targetClients),
      db.select({ count: sql<number>`count(*)` }).from(casts),
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(reactions),
      db.select({ count: sql<number>`count(*)` }).from(links),
      db.select({ count: sql<number>`count(*)` }).from(targets).where(sql`${targets.lastSyncedAt} IS NULL`),
      getAllQueueStats(),
    ]);

    // Calculate recent activity (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentCasts, recentReactions] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(casts)
        .where(sql`${casts.timestamp} > ${last24Hours}`),
      db.select({ count: sql<number>`count(*)` })
        .from(reactions)
        .where(sql`${reactions.timestamp} > ${last24Hours}`),
    ]);

    return c.json({
      stats: {
        targets: {
          total: totalTargets[0]?.count || 0,
          root: rootTargets[0]?.count || 0,
          clients: clientTargets[0]?.count || 0,
          unsynced: unsyncedTargets[0]?.count || 0,
        },
        data: {
          casts: totalCasts[0]?.count || 0,
          users: totalUsers[0]?.count || 0,
          reactions: totalReactions[0]?.count || 0,
          links: totalLinks[0]?.count || 0,
        },
        activity: {
          recentCasts: recentCasts[0]?.count || 0,
          recentReactions: recentReactions[0]?.count || 0,
        },
        queues: queueStats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get realtime stats error:', error);
    return c.json({ error: 'Failed to fetch realtime stats' }, 500);
  }
});

export { adminRoutes };