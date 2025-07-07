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
import { RefreshCw, TrendingUp } from "lucide-react";

const TrendingPage = () => {
  const { data, loading, error, hasMore, loadMore, refresh } = useFeed({
    useTrending: true, // Always use trending endpoint for this page
  });
  const { handleReply, handleLike, handleRecast } = useCastInteractions();

  return (
    <div className="w-full">
      <div className="border-b border-gray-200 p-3 md:p-4 bg-white sticky top-0 z-10 border-x-0 md:border-x">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-orange-500" />
            <h1 className="text-lg sm:text-xl font-bold">Trending</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refresh()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Popular casts on Farcaster right now
        </p>
      </div>

      {error && <ErrorState error={error} onRetry={refresh} />}

      {data.length === 0 && !loading && !error && (
        <EmptyState
          title="No trending content"
          description="Check back later for trending casts"
        />
      )}

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

export default TrendingPage;
