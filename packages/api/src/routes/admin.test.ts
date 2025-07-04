import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { adminRoutes } from './admin.js';

// Mock the database and auth middleware
vi.mock('@farcaster-indexer/shared', () => ({
  db: {
    query: {
      targets: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      targetClients: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => [{ count: 10 }]),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [{ fid: 1, isRoot: false, addedAt: new Date() }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => [{ fid: 1, isRoot: true, addedAt: new Date() }]),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({})),
    })),
  },
  schema: {
    targets: {},
    targetClients: {},
    casts: {},
    users: {},
    links: {},
    reactions: {},
  },
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: vi.fn(async (c, next) => {
    // Mock successful authentication
    c.set('user', { id: 'admin', role: 'admin' });
    await next();
  }),
}));

// Create test app with admin routes
const testApp = new Hono();
testApp.route('/admin', adminRoutes);

describe('Admin Routes', () => {
  describe('GET /admin/targets', () => {
    it('should return paginated targets list', async () => {
      const mockTargets = [
        { fid: 1, isRoot: true, addedAt: new Date(), lastSyncedAt: null },
        { fid: 2, isRoot: false, addedAt: new Date(), lastSyncedAt: new Date() },
      ];

      const { db } = await import('@farcaster-indexer/shared');
      vi.mocked(db.query.targets.findMany).mockResolvedValue(mockTargets);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => [{ count: 50 }]),
        })),
      } as any);

      const res = await testApp.request('/admin/targets');
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.targets).toHaveLength(2);
      expect(data.pagination.total).toBe(50);
    });

    it('should handle search and filtering', async () => {
      const mockTargets = [
        { fid: 1, isRoot: true, addedAt: new Date(), lastSyncedAt: null },
      ];

      const { db } = await import('@farcaster-indexer/shared');
      vi.mocked(db.query.targets.findMany).mockResolvedValue(mockTargets);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => [{ count: 1 }]),
        })),
      } as any);

      const res = await testApp.request('/admin/targets?search=1&is_root=true');
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.targets).toHaveLength(1);
      expect(data.targets[0].fid).toBe(1);
    });
  });

  describe('POST /admin/targets', () => {
    it('should add new target successfully', async () => {
      const mockTarget = { fid: 123, isRoot: false, addedAt: new Date() };

      const { db } = await import('@farcaster-indexer/shared');
      vi.mocked(db.query.targets.findFirst).mockResolvedValue(null);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn(() => ({
          returning: vi.fn(() => [mockTarget]),
        })),
      } as any);

      const res = await testApp.request('/admin/targets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fid: 123,
          isRoot: false,
        }),
      });

      expect(res.status).toBe(201);
      
      const data = await res.json();
      expect(data.target.fid).toBe(123);
    });

    it('should return 400 for invalid FID', async () => {
      const res = await testApp.request('/admin/targets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fid: 'invalid',
        }),
      });

      expect(res.status).toBe(400);
      
      const data = await res.json();
      expect(data.error).toBe('Valid FID is required');
    });

    it('should return 409 for existing target', async () => {
      const existingTarget = { fid: 123, isRoot: false, addedAt: new Date() };

      const { db } = await import('@farcaster-indexer/shared');
      vi.mocked(db.query.targets.findFirst).mockResolvedValue(existingTarget);

      const res = await testApp.request('/admin/targets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fid: 123,
          isRoot: false,
        }),
      });

      expect(res.status).toBe(409);
      
      const data = await res.json();
      expect(data.error).toBe('Target already exists');
    });
  });

  describe('PUT /admin/targets/:fid', () => {
    it('should update target successfully', async () => {
      const existingTarget = { fid: 123, isRoot: false, addedAt: new Date() };
      const updatedTarget = { fid: 123, isRoot: true, addedAt: new Date() };

      const { db } = await import('@farcaster-indexer/shared');
      vi.mocked(db.query.targets.findFirst).mockResolvedValue(existingTarget);
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => [updatedTarget]),
          })),
        })),
      } as any);

      const res = await testApp.request('/admin/targets/123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isRoot: true,
        }),
      });

      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.target.isRoot).toBe(true);
    });

    it('should return 404 for non-existent target', async () => {
      const { db } = await import('@farcaster-indexer/shared');
      vi.mocked(db.query.targets.findFirst).mockResolvedValue(null);

      const res = await testApp.request('/admin/targets/999', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isRoot: true,
        }),
      });

      expect(res.status).toBe(404);
      
      const data = await res.json();
      expect(data.error).toBe('Target not found');
    });
  });

  describe('DELETE /admin/targets/:fid', () => {
    it('should delete target successfully', async () => {
      const existingTarget = { fid: 123, isRoot: false, addedAt: new Date() };

      const { db } = await import('@farcaster-indexer/shared');
      vi.mocked(db.query.targets.findFirst).mockResolvedValue(existingTarget);
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn(() => ({})),
      } as any);

      const res = await testApp.request('/admin/targets/123', {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return 404 for non-existent target', async () => {
      const { db } = await import('@farcaster-indexer/shared');
      vi.mocked(db.query.targets.findFirst).mockResolvedValue(null);

      const res = await testApp.request('/admin/targets/999', {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);
      
      const data = await res.json();
      expect(data.error).toBe('Target not found');
    });
  });

  describe('GET /admin/targets/:fid/stats', () => {
    it('should return target statistics', async () => {
      const existingTarget = { fid: 123, isRoot: false, addedAt: new Date() };

      const { db } = await import('@farcaster-indexer/shared');
      vi.mocked(db.query.targets.findFirst).mockResolvedValue(existingTarget);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => [{ count: 25 }]),
        })),
      } as any);

      const res = await testApp.request('/admin/targets/123/stats');
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.target.fid).toBe(123);
      expect(data.stats.casts).toBe(25);
      expect(data.stats.followers).toBe(25);
      expect(data.stats.following).toBe(25);
      expect(data.stats.reactions).toBe(25);
    });
  });

  describe('POST /admin/targets/:fid/backfill', () => {
    it('should trigger backfill successfully', async () => {
      const existingTarget = { fid: 123, isRoot: false, addedAt: new Date() };

      const { db } = await import('@farcaster-indexer/shared');
      vi.mocked(db.query.targets.findFirst).mockResolvedValue(existingTarget);

      const res = await testApp.request('/admin/targets/123/backfill', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Backfill job queued for FID 123');
    });
  });

  describe('GET /admin/client-targets', () => {
    it('should return paginated client targets list', async () => {
      const mockClients = [
        { clientFid: 100, addedAt: new Date() },
        { clientFid: 101, addedAt: new Date() },
      ];

      const { db } = await import('@farcaster-indexer/shared');
      vi.mocked(db.query.targetClients.findMany).mockResolvedValue(mockClients);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => [{ count: 10 }]),
      } as any);

      const res = await testApp.request('/admin/client-targets');
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.clientTargets).toHaveLength(2);
      expect(data.pagination.total).toBe(10);
    });
  });

  describe('POST /admin/client-targets', () => {
    it('should add new client target successfully', async () => {
      const mockClient = { clientFid: 200, addedAt: new Date() };

      const { db } = await import('@farcaster-indexer/shared');
      vi.mocked(db.query.targetClients.findFirst).mockResolvedValue(null);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn(() => ({
          returning: vi.fn(() => [mockClient]),
        })),
      } as any);

      const res = await testApp.request('/admin/client-targets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientFid: 200,
        }),
      });

      expect(res.status).toBe(201);
      
      const data = await res.json();
      expect(data.clientTarget.clientFid).toBe(200);
    });

    it('should return 409 for existing client target', async () => {
      const existingClient = { clientFid: 200, addedAt: new Date() };

      const { db } = await import('@farcaster-indexer/shared');
      vi.mocked(db.query.targetClients.findFirst).mockResolvedValue(existingClient);

      const res = await testApp.request('/admin/client-targets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientFid: 200,
        }),
      });

      expect(res.status).toBe(409);
      
      const data = await res.json();
      expect(data.error).toBe('Client target already exists');
    });
  });

  describe('GET /admin/jobs', () => {
    it('should return job queue statistics', async () => {
      const res = await testApp.request('/admin/jobs');
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.jobs.backfillQueue).toBeDefined();
      expect(data.jobs.realtimeQueue).toBeDefined();
      expect(data.jobs.realtimeQueue.active).toBe(1);
    });
  });

  describe('POST /admin/jobs/backfill', () => {
    it('should trigger full backfill successfully', async () => {
      const unsyncedTargets = [
        { fid: 1, isRoot: true, addedAt: new Date(), lastSyncedAt: null },
        { fid: 2, isRoot: false, addedAt: new Date(), lastSyncedAt: null },
      ];

      const { db } = await import('@farcaster-indexer/shared');
      vi.mocked(db.query.targets.findMany).mockResolvedValue(unsyncedTargets);

      const res = await testApp.request('/admin/jobs/backfill', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Backfill jobs queued for 2 targets');
    });
  });

  describe('GET /admin/stats', () => {
    it('should return system statistics', async () => {
      const { db } = await import('@farcaster-indexer/shared');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => [{ count: 100 }]),
      } as any);

      const res = await testApp.request('/admin/stats');
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.stats.targets.total).toBe(100);
      expect(data.stats.targets.root).toBe(100);
      expect(data.stats.targets.clients).toBe(100);
      expect(data.stats.data.casts).toBe(100);
      expect(data.stats.data.users).toBe(100);
      expect(data.stats.data.reactions).toBe(100);
      expect(data.stats.data.links).toBe(100);
    });
  });
});