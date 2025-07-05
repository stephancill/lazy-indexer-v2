import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { DashboardStats } from '../types';


export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async (): Promise<DashboardStats> => {
      const [healthData, jobsData] = await Promise.all([
        api.admin.health.stats(),
        api.admin.jobs.list(),
      ]);

      const health = healthData as any;
      const jobs = jobsData as any;

      // Parse the response structure
      const statsData = health.stats || {};
      const queuesData = jobs.jobs || {};
      
      // Calculate total job stats
      const totalJobs = Object.values(queuesData as Record<string, any>).reduce((acc, queue: any) => ({
        active: acc.active + (queue.active || 0),
        waiting: acc.waiting + (queue.waiting || 0),
        completed: acc.completed + (queue.completed || 0),
        failed: acc.failed + (queue.failed || 0),
      }), { active: 0, waiting: 0, completed: 0, failed: 0 });

      return {
        targets: {
          total: parseInt(statsData.targets?.total || '0'),
          root: parseInt(statsData.targets?.root || '0'),
          synced: parseInt(statsData.targets?.total || '0') - parseInt(statsData.targets?.root || '0'),
          unsynced: 0
        },
        clientTargets: { 
          total: parseInt(statsData.targets?.clients || '0')
        },
        jobs: totalJobs,
        system: { 
          status: 'healthy' as const, 
          uptime: 0, 
          lastSync: new Date().toISOString(),
          services: { database: true, redis: true, hubs: true }
        },
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useSystemHealth = () => {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await api.admin.health.check();
      return response;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });
};