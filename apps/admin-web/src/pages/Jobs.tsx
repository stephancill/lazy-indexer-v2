import type React from "react";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Activity,
  Play,
  Pause,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Database,
  Zap,
} from "lucide-react";
import { useJobs, useTriggerBackfill } from "../hooks/useJobs";

const Jobs: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, isLoading: loading, error } = useJobs(autoRefresh);
  const triggerBackfillMutation = useTriggerBackfill();

  const queueStats = data?.queues || [];
  const recentJobs = data?.recentJobs || [];

  const handleTriggerBackfill = () => {
    if (
      !confirm(
        "This will queue backfill jobs for all unsynced targets. Continue?"
      )
    )
      return;
    triggerBackfillMutation.mutate();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "waiting":
        return "bg-yellow-100 text-yellow-800";
      case "delayed":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Activity className="h-3 w-3" />;
      case "completed":
        return <CheckCircle className="h-3 w-3" />;
      case "failed":
        return <XCircle className="h-3 w-3" />;
      case "waiting":
        return <Clock className="h-3 w-3" />;
      case "delayed":
        return <AlertTriangle className="h-3 w-3" />;
      default:
        return <Activity className="h-3 w-3" />;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-gray-600 mt-1">
            Monitor and manage background jobs
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
            size="sm"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`}
            />
            Auto Refresh
          </Button>
          <Button
            onClick={handleTriggerBackfill}
            className="flex items-center space-x-2"
          >
            <Database className="h-4 w-4" />
            <span>Trigger Backfill</span>
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <XCircle className="h-4 w-4" />
              <span>
                {error instanceof Error ? error.message : "An error occurred"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {queueStats.map((queue) => (
          <Card key={queue.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium capitalize">
                {queue.name.replace(/([A-Z])/g, " $1").trim()} Queue
              </CardTitle>
              <div className="flex items-center space-x-2">
                {queue.paused ? (
                  <Badge className="bg-red-100 text-red-800">
                    <Pause className="h-3 w-3 mr-1" />
                    Paused
                  </Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800">
                    <Play className="h-3 w-3 mr-1" />
                    Running
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Active</span>
                  <span className="font-medium">{queue.active}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Waiting</span>
                  <span className="font-medium">{queue.waiting}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Completed</span>
                  <span className="font-medium text-green-600">
                    {queue.completed}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Failed</span>
                  <span className="font-medium text-red-600">
                    {queue.failed}
                  </span>
                </div>
                {queue.delayed > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Delayed</span>
                    <span className="font-medium text-orange-600">
                      {queue.delayed}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>Recent Jobs</span>
              </div>
            </CardTitle>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              disabled={loading}
              size="sm"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && recentJobs.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <span className="text-gray-600">Loading jobs...</span>
              </div>
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No recent jobs found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex-shrink-0">
                      <Badge className={getStatusColor(job.status)}>
                        {getStatusIcon(job.status)}
                        <span className="ml-1 capitalize">{job.status}</span>
                      </Badge>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {job.name}
                        </span>
                        {job.progress > 0 && job.status === "active" && (
                          <span className="text-sm text-blue-600">
                            {Math.round(job.progress)}%
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        ID: {job.id}
                        {job.data?.fid && ` • FID: ${job.data.fid}`}
                        {job.data?.targetCount &&
                          ` • ${job.data.targetCount} targets`}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Created: {formatDate(job.createdAt)}
                        {job.processedAt &&
                          ` • Started: ${formatDate(job.processedAt)}`}
                        {job.finishedAt &&
                          ` • Finished: ${formatDate(job.finishedAt)}`}
                        {job.duration &&
                          ` • Duration: ${formatDuration(job.duration)}`}
                      </div>
                      {job.error && (
                        <div className="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded">
                          Error: {job.error}
                        </div>
                      )}
                    </div>
                  </div>
                  {job.status === "active" && job.progress > 0 && (
                    <div className="flex-shrink-0 w-20">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Queue Information */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-sm text-blue-900">
            Job Queue Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              <strong>Backfill Queue:</strong> Processes historical data for
              individual targets
            </p>
            <p>
              <strong>Realtime Queue:</strong> Handles real-time event
              processing and target discovery
            </p>
            <p>
              <strong>Auto Refresh:</strong> Enable to automatically update job
              status every 5 seconds
            </p>
            <p>
              <strong>Trigger Backfill:</strong> Queue backfill jobs for all
              unsynced targets
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Jobs;
