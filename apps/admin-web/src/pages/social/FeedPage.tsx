import { useFeed } from "@/hooks/useFeed";
import { useCastInteractions } from "@/hooks/useCastInteractions";
import CastCard from "@/components/social/CastCard";
import InfiniteScroll from "@/components/social/InfiniteScroll";
import {
  LoadingState,
  EmptyState,
  ErrorState,
} from "@/components/social/LoadingState";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const FeedPage = () => {
  const { data, loading, error, hasMore, loadMore, refresh } = useFeed({
    useTrending: true, // Use trending endpoint for demo since there's no feed data
  });
  const { handleReply, handleLike, handleRecast } = useCastInteractions();

  const handleRefresh = () => {
    refresh();
  };

  return (
    <div className="w-full">
      <div className="border-b border-gray-200 p-3 md:p-4 bg-white sticky top-0 z-10 border-x-0 md:border-x">
        <div className="flex items-center justify-between">
          <h1 className="text-lg sm:text-xl font-bold">Home</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={handleRefresh} />}

      {data.length === 0 && !loading && !error && <EmptyState />}

      <InfiniteScroll
        data={data}
        loading={loading}
        hasMore={hasMore}
        loadMore={loadMore}
        renderItem={(cast) => (
          <CastCard
            key={cast.hash}
            cast={{
              ...cast,
              replyCount: cast.stats?.replies || 0,
              likeCount:
                cast.stats?.likes || Number.parseInt(cast.reactionCount || "0"),
              recastCount: cast.stats?.recasts || 0,
            }}
            onReply={handleReply}
            onLike={handleLike}
            onRecast={handleRecast}
          />
        )}
        skeleton={<LoadingState count={5} />}
      />
    </div>
  );
};

export default FeedPage;
