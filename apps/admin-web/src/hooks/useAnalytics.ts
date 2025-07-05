import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface AnalyticsData {
  overview: {
    totalTargets: number;
    totalCasts: number;
    totalReactions: number;
    totalLinks: number;
    avgCastsPerTarget: number;
    avgReactionsPerCast: number;
  };
  growth: {
    newTargetsToday: number;
    newTargetsThisWeek: number;
    newTargetsThisMonth: number;
    castsToday: number;
    castsThisWeek: number;
    castsThisMonth: number;
  };
  topTargets: Array<{
    fid: number;
    displayName?: string;
    username?: string;
    castCount: number;
    reactionCount: number;
    followerCount?: number;
  }>;
  recentActivity: Array<{
    date: string;
    newTargets: number;
    totalCasts: number;
    totalReactions: number;
  }>;
}

export const useAnalytics = (timeRange: "7d" | "30d" | "90d" = "30d") => {
  return useQuery({
    queryKey: ["analytics", timeRange],
    queryFn: async (): Promise<AnalyticsData> => {
      // Note: This would typically call a dedicated analytics endpoint
      // For now, we'll use the health stats endpoint and simulate analytics data
      const response = await api.admin.health.stats();
      const data = response as {
        targets?: { total?: number };
        stats?: {
          totalCasts?: number;
          totalReactions?: number;
          totalLinks?: number;
          avgCastsPerTarget?: number;
          avgReactionsPerCast?: number;
        };
        growth?: {
          newTargetsToday?: number;
          newTargetsThisWeek?: number;
          newTargetsThisMonth?: number;
          castsToday?: number;
          castsThisWeek?: number;
          castsThisMonth?: number;
        };
        topTargets?: Array<{
          fid: number;
          displayName?: string;
          username?: string;
          castCount: number;
          reactionCount: number;
          followerCount?: number;
        }>;
        recentActivity?: Array<{
          date: string;
          newTargets: number;
          totalCasts: number;
          totalReactions: number;
        }>;
      };

      return {
        overview: {
          totalTargets: data?.targets?.total || 0,
          totalCasts: data?.stats?.totalCasts || 0,
          totalReactions: data?.stats?.totalReactions || 0,
          totalLinks: data?.stats?.totalLinks || 0,
          avgCastsPerTarget: data?.stats?.avgCastsPerTarget || 0,
          avgReactionsPerCast: data?.stats?.avgReactionsPerCast || 0,
        },
        growth: {
          newTargetsToday: data?.growth?.newTargetsToday || 0,
          newTargetsThisWeek: data?.growth?.newTargetsThisWeek || 0,
          newTargetsThisMonth: data?.growth?.newTargetsThisMonth || 0,
          castsToday: data?.growth?.castsToday || 0,
          castsThisWeek: data?.growth?.castsThisWeek || 0,
          castsThisMonth: data?.growth?.castsThisMonth || 0,
        },
        topTargets: data?.topTargets || [],
        recentActivity: data?.recentActivity || [],
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
