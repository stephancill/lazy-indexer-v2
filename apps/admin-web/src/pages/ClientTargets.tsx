import type React from "react";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Plus, RefreshCw, XCircle, Users, User } from "lucide-react";
import {
  useClientTargets,
  useCreateClientTarget,
  useDeleteClientTarget,
} from "../hooks/useClientTargets";

const ClientTargets: React.FC = () => {
  const [newFid, setNewFid] = useState("");

  const { data, isLoading: loading, error, refetch } = useClientTargets();
  const createClientTargetMutation = useCreateClientTarget();
  const deleteClientTargetMutation = useDeleteClientTarget();

  const clientTargets = data?.clientTargets || [];
  const adding = createClientTargetMutation.isPending;

  const handleAddClientTarget = () => {
    if (!newFid.trim()) return;

    const fid = Number.parseInt(newFid.trim());
    if (isNaN(fid) || fid <= 0) {
      return;
    }

    createClientTargetMutation.mutate(fid, {
      onSuccess: () => {
        setNewFid("");
      },
    });
  };

  const handleRemoveClientTarget = (fid: number) => {
    if (!confirm(`Are you sure you want to remove client target ${fid}?`))
      return;
    deleteClientTargetMutation.mutate(fid);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Targets</h1>
          <p className="text-gray-600 mt-1">
            Monitor client apps to automatically discover new root targets when
            users sign up
          </p>
        </div>
      </div>

      {/* Add Client Target */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Add Client Target
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Enter client FID to monitor..."
                value={newFid}
                onChange={(e) => setNewFid(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddClientTarget()}
                disabled={adding}
              />
            </div>
            <Button
              onClick={handleAddClientTarget}
              disabled={!newFid.trim() || adding}
              className="flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>{adding ? "Adding..." : "Add Client"}</span>
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            When users sign up through this client app, they'll automatically be
            added as root targets
          </p>
        </CardContent>
      </Card>

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

      {/* Client Targets List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Client Targets ({clientTargets.length})</span>
              </div>
            </CardTitle>
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
        </CardHeader>
        <CardContent>
          {loading && clientTargets.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="text-gray-600">Loading client targets...</span>
              </div>
            </div>
          ) : clientTargets.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No client targets configured</p>
              <p className="text-sm text-gray-500 mt-1">
                Add client apps to monitor for automatic target discovery
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {clientTargets.map((client) => (
                <div
                  key={client.clientFid}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {client.pfpUrl ? (
                        <img
                          src={client.pfpUrl}
                          alt={client.displayName || `FID ${client.clientFid}`}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {client.displayName || `FID ${client.clientFid}`}
                        </span>
                        <Badge className="bg-blue-100 text-blue-800">
                          Client
                        </Badge>
                        {client.discoveredTargets &&
                          client.discoveredTargets > 0 && (
                            <Badge className="bg-green-100 text-green-800">
                              {client.discoveredTargets} discovered
                            </Badge>
                          )}
                      </div>
                      <div className="text-sm text-gray-600">
                        FID: {client.clientFid}
                        {client.username && ` • @${client.username}`}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Added: {formatDate(client.addedAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => handleRemoveClientTarget(client.clientFid)}
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-sm text-blue-900">
            How Client Target Discovery Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              • Client targets are FIDs representing applications or services
              that users interact with
            </p>
            <p>
              • When a user signs up through a monitored client app, they're
              automatically added as a root target
            </p>
            <p>
              • This enables automatic discovery of new users without manual
              intervention
            </p>
            <p>
              • The system monitors ON_CHAIN_EVENT (SIGNER) events to detect new
              user signups
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientTargets;
