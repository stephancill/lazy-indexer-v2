import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Job, QueueStats } from '../types';

interface JobsResponse {
  queues: QueueStats[];
  recentJobs: Job[];
}

interface JobStatsResponse {
  jobs: {
    active: number;
    completed: number;
    failed: number;
    waiting: number;
  };
}

export const useJobs = (autoRefresh: boolean = false) => {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: async (): Promise<JobsResponse> => {
      const response = await api.admin.jobs.list() as any;
      
      // Transform the API response to match expected structure
      const queues = Object.entries(response.jobs || {}).map(([name, stats]: [string, any]) => ({
        name,
        active: stats.active || 0,
        waiting: stats.waiting || 0,
        completed: stats.completed || 0,
        failed: stats.failed || 0,
        delayed: stats.delayed || 0,
        paused: stats.paused || 0,
      }));
      
      return {
        queues,
        recentJobs: [], // API doesn't provide recent jobs in this endpoint
      };
    },
    refetchInterval: autoRefresh ? 5000 : false, // Auto-refresh every 5 seconds
  });
};

export const useJobStats = () => {
  return useQuery({
    queryKey: ['job-stats'],
    queryFn: async (): Promise<JobStatsResponse> => {
      const response = await api.admin.jobs.list() as any;
      
      // Calculate totals from all queues
      const jobsData = response.jobs || {};
      const totals = Object.values(jobsData).reduce((acc: any, queue: any) => ({
        active: acc.active + (queue.active || 0),
        waiting: acc.waiting + (queue.waiting || 0),
        completed: acc.completed + (queue.completed || 0),
        failed: acc.failed + (queue.failed || 0),
      }), { active: 0, waiting: 0, completed: 0, failed: 0 });
      
      return { jobs: totals as { active: number; completed: number; failed: number; waiting: number; } };
    },
  });
};

export const useTriggerBackfill = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      return api.admin.jobs.backfill();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['targets'] });
    },
  });
};