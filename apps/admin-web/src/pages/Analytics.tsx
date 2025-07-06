import type React from "react";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  BarChart3,
  TrendingUp,
  Users,
  MessageSquare,
  Heart,
  RefreshCw,
  Target,
  Activity,
} from "lucide-react";
import { useAnalytics } from "../hooks/useAnalytics";

const Analytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  const {
    data: analytics,
    isLoading: loading,
    error,
    refetch,
  } = useAnalytics(timeRange);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">
            Insights into your Farcaster indexing performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex rounded-md shadow-sm">
            <Button
              variant={timeRange === "7d" ? "default" : "outline"}
              onClick={() => setTimeRange("7d")}
              size="sm"
              className="rounded-r-none"
            >
              7D
            </Button>
            <Button
              variant={timeRange === "30d" ? "default" : "outline"}
              onClick={() => setTimeRange("30d")}
              size="sm"
              className="rounded-none border-l-0"
            >
              30D
            </Button>
            <Button
              variant={timeRange === "90d" ? "default" : "outline"}
              onClick={() => setTimeRange("90d")}
              size="sm"
              className="rounded-l-none border-l-0"
            >
              90D
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={loading}
            size="sm"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <span className="text-gray-600">Loading analytics...</span>
          </div>
        </div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600">
                {error instanceof Error
                  ? error.message
                  : "Failed to load analytics"}
              </p>
              <Button onClick={() => refetch()} className="mt-4">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overview Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Targets
                </CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(analytics?.overview.totalTargets || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(analytics?.overview.avgCastsPerTarget || 0)} avg
                  casts per target
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Casts
                </CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(analytics?.overview.totalCasts || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(analytics?.growth.castsToday || 0)} today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Reactions
                </CardTitle>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(analytics?.overview.totalReactions || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics?.overview.avgReactionsPerCast?.toFixed(1) || 0} avg
                  per cast
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Growth Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Growth Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {analytics?.growth.newTargetsToday || 0}
                  </div>
                  <div className="text-sm text-gray-600">New Targets Today</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {analytics?.growth.newTargetsThisWeek || 0}
                  </div>
                  <div className="text-sm text-gray-600">
                    New Targets This Week
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {analytics?.growth.newTargetsThisMonth || 0}
                  </div>
                  <div className="text-sm text-gray-600">
                    New Targets This Month
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {formatNumber(analytics?.growth.castsToday || 0)}
                  </div>
                  <div className="text-sm text-gray-600">Casts Today</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-teal-600">
                    {formatNumber(analytics?.growth.castsThisWeek || 0)}
                  </div>
                  <div className="text-sm text-gray-600">Casts This Week</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">
                    {formatNumber(analytics?.growth.castsThisMonth || 0)}
                  </div>
                  <div className="text-sm text-gray-600">Casts This Month</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Targets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Top Targets by Activity Score
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Ranked by activity score: Casts × 3 + Reactions × 1 + Followers
                × 2
              </p>
            </CardHeader>
            <CardContent>
              {analytics?.topTargets && analytics.topTargets.length > 0 ? (
                <div className="space-y-4">
                  {analytics.topTargets.slice(0, 10).map((target, index) => (
                    <div
                      key={target.fid}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg space-y-3 sm:space-y-0"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">
                          {index + 1}
                        </div>
                        {target.pfpUrl ? (
                          <img
                            src={target.pfpUrl}
                            alt={target.displayName || `FID ${target.fid}`}
                            className="w-12 h-12 rounded-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                            {target.displayName?.[0] ||
                              target.fid.toString()[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate flex items-center">
                            {target.displayName || `FID ${target.fid}`}
                            <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                              #{target.fid}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {target.username && `@${target.username}`}
                            {target.isRoot && (
                              <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                Root
                              </span>
                            )}
                          </div>
                          {target.bio && (
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {target.bio}
                            </div>
                          )}
                          {target.syncedAt && (
                            <div className="text-xs text-green-600 mt-1">
                              Synced:{" "}
                              {new Date(target.syncedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-center sm:justify-end space-x-4 text-sm">
                        <div className="text-center">
                          <div className="font-bold text-purple-600">
                            {formatNumber(target.activityScore)}
                          </div>
                          <div className="text-gray-500">Activity</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-blue-600">
                            {formatNumber(target.castCount)}
                          </div>
                          <div className="text-gray-500">Casts</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-red-600">
                            {formatNumber(target.reactionCount)}
                          </div>
                          <div className="text-gray-500">Reactions</div>
                        </div>
                        {target.followerCount && (
                          <div className="text-center">
                            <div className="font-bold text-green-600">
                              {formatNumber(target.followerCount)}
                            </div>
                            <div className="text-gray-500">Followers</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-16 bg-gray-50 rounded-lg">
                <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg font-medium">
                  Activity Chart
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Interactive charts showing recent activity trends would be
                  displayed here
                </p>
                <p className="text-gray-400 text-xs mt-4">
                  Consider integrating with Chart.js, Recharts, or D3.js for
                  data visualization
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Analytics;
