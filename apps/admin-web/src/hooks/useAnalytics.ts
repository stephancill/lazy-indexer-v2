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
    pfpUrl?: string;
    bio?: string;
    castCount: number;
    reactionCount: number;
    followerCount?: number;
    activityScore: number;
    isRoot: boolean;
    addedAt: string;
    syncedAt?: string | null;
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
      // Use the new dedicated analytics endpoint
      const response = await api.admin.analytics(timeRange);
      return response as AnalyticsData;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
