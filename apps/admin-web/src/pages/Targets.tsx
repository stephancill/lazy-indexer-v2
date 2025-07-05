import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { 
  Search, 
  Plus, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Crown,
  User
} from 'lucide-react';
import { useTargets, useCreateTarget, useDeleteTarget, useBackfillTarget } from '../hooks/useTargets';

const Targets: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnsynced, setFilterUnsynced] = useState(false);
  const [filterRoot, setFilterRoot] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);

  const params = {
    page,
    limit: 20,
    ...(searchTerm && { search: searchTerm }),
    ...(filterUnsynced && { unsynced: true }),
    ...(filterRoot !== null && { isRoot: filterRoot }),
  };

  const { data, isLoading: loading, error, refetch } = useTargets(params);
  const createTargetMutation = useCreateTarget();
  const deleteTargetMutation = useDeleteTarget();
  const backfillTargetMutation = useBackfillTarget();

  const targets = data?.targets || [];
  const totalPages = data?.totalPages || 1;

  const handleBackfill = (fid: number) => {
    backfillTargetMutation.mutate(fid);
  };

  const handleAddTarget = () => {
    const fid = prompt('Enter FID to add:');
    if (!fid) return;

    const isRoot = confirm('Is this a root target?');
    createTargetMutation.mutate({ fid: parseInt(fid), isRoot });
  };

  const handleRemoveTarget = (fid: number) => {
    if (!confirm(`Are you sure you want to remove target ${fid}?`)) return;
    deleteTargetMutation.mutate(fid);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Targets</h1>
        <Button onClick={handleAddTarget} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Add Target</span>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by FID, username, or display name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterUnsynced ? "default" : "outline"}
                onClick={() => setFilterUnsynced(!filterUnsynced)}
                size="sm"
              >
                Unsynced Only
              </Button>
              <Button
                variant={filterRoot === true ? "default" : "outline"}
                onClick={() => setFilterRoot(filterRoot === true ? null : true)}
                size="sm"
              >
                <Crown className="h-4 w-4 mr-1" />
                Root Only
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setFilterUnsynced(false);
                  setFilterRoot(null);
                  setPage(1);
                }}
                size="sm"
              >
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <XCircle className="h-4 w-4" />
              <span>{error instanceof Error ? error.message : 'An error occurred'}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Targets List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Targets ({targets.length})</CardTitle>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={loading}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && targets.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="text-gray-600">Loading targets...</span>
              </div>
            </div>
          ) : targets.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No targets found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {targets.map((target) => (
                <div key={target.fid} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {target.pfpUrl ? (
                        <img 
                          src={target.pfpUrl} 
                          alt={target.displayName || `FID ${target.fid}`}
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
                          {target.displayName || `FID ${target.fid}`}
                        </span>
                        {target.isRoot && (
                          <Badge className="bg-amber-100 text-amber-800">
                            <Crown className="h-3 w-3 mr-1" />
                            Root
                          </Badge>
                        )}
                        {target.lastSyncedAt ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Synced
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Unsynced
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        FID: {target.fid}
                        {target.username && ` • @${target.username}`}
                        {target.followerCount && ` • ${target.followerCount} followers`}
                        {target.castCount && ` • ${target.castCount} casts`}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Added: {formatDate(target.addedAt)}
                        {target.lastSyncedAt && ` • Last synced: ${formatDate(target.lastSyncedAt)}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!target.lastSyncedAt && (
                      <Button
                        variant="outline"
                        onClick={() => handleBackfill(target.fid)}
                        size="sm"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Backfill
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => handleRemoveTarget(target.fid)}
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
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  size="sm"
                >
                  Previous
                </Button>
                <span className="px-4 py-2 text-sm text-gray-600 flex items-center">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Targets;