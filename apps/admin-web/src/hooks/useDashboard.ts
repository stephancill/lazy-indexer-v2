import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { DashboardStats } from "../types";

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async (): Promise<DashboardStats> => {
      const [healthData, jobsData] = await Promise.all([
        api.admin.health.stats(),
        api.admin.jobs.list(),
      ]);

      const health = healthData as {
        stats?: {
          targets?: {
            total?: number;
            root?: number;
            clients?: number;
            synced?: number;
            unsynced?: number;
            waiting?: number;
          };
          data?: {
            casts?: number;
            users?: number;
            reactions?: number;
            links?: number;
          };
        };
      };
      const jobs = jobsData as {
        jobs?: Record<
          string,
          {
            active?: number;
            waiting?: number;
            completed?: number;
            failed?: number;
          }
        >;
      };

      // Parse the response structure
      const statsData = health.stats || {};
      const queuesData = jobs.jobs || {};

      // Calculate total job stats
      const totalJobs = Object.values(queuesData).reduce(
        (acc, queue) => {
          return {
            active: (acc.active || 0) + (queue.active || 0),
            waiting: (acc.waiting || 0) + (queue.waiting || 0),
            completed: (acc.completed || 0) + (queue.completed || 0),
            failed: (acc.failed || 0) + (queue.failed || 0),
          };
        },
        { active: 0, waiting: 0, completed: 0, failed: 0 }
      );

      return {
        targets: {
          total: statsData.targets?.total || 0,
          root: statsData.targets?.root || 0,
          synced: statsData.targets?.synced || 0,
          unsynced: statsData.targets?.unsynced || 0,
          waiting: statsData.targets?.waiting || 0,
        },
        clientTargets: {
          total: statsData.targets?.clients || 0,
        },
        jobs: {
          active: totalJobs.active || 0,
          waiting: totalJobs.waiting || 0,
          completed: totalJobs.completed || 0,
          failed: totalJobs.failed || 0,
        },
        system: {
          status: "healthy" as const,
          uptime: 0,
          lastSync: new Date().toISOString(),
          services: { database: true, redis: true, hubs: true },
        },
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useSystemHealth = () => {
  return useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      const response = await api.admin.health.check();
      return response;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });
};
