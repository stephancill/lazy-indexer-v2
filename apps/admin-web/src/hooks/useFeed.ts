import { useInfiniteQuery } from "@tanstack/react-query";
import type { Cast } from "@/types";

interface UseFeedOptions {
  fid?: number;
  limit?: number;
  useTrending?: boolean; // Fallback to trending if no feed data
}

interface FeedPage {
  casts: Cast[];
  hasMore: boolean;
  offset: number;
}

const fetchFeedPage = async (
  fid: number | undefined,
  limit: number,
  offset: number,
  useTrending: boolean
): Promise<FeedPage> => {
  let newCasts: Cast[] = [];
  let currentHasMore = false;

  if (useTrending) {
    // Use trending endpoint for demo
    const response = await fetch(
      `http://localhost:3000/api/v1/trending?limit=${limit}&offset=${offset}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    newCasts = data.trending || [];
    currentHasMore = data.pagination?.hasMore ?? newCasts.length === limit;
  } else {
    // Try to get feed for specific user, fallback to trending if empty
    try {
      const response = await fetch(
        `http://localhost:3000/api/v1/feed/${
          fid || 1
        }?limit=${limit}&offset=${offset}`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const feedData = await response.json();
      newCasts = feedData.feed || [];
      currentHasMore =
        feedData.pagination?.hasMore ?? newCasts.length === limit;

      // If feed is empty and we're on first load, fallback to trending
      if (newCasts.length === 0 && offset === 0) {
        const trendingResponse = await fetch(
          `http://localhost:3000/api/v1/trending?limit=${limit}&offset=${offset}`
        );
        if (trendingResponse.ok) {
          const trendingData = await trendingResponse.json();
          newCasts = trendingData.trending || [];
          currentHasMore =
            trendingData.pagination?.hasMore ?? newCasts.length === limit;
        }
      }
    } catch {
      // Fallback to trending if feed fails
      const trendingResponse = await fetch(
        `http://localhost:3000/api/v1/trending?limit=${limit}&offset=${offset}`
      );
      if (!trendingResponse.ok)
        throw new Error(`HTTP ${trendingResponse.status}`);

      const trendingData = await trendingResponse.json();
      newCasts = trendingData.trending || [];
      currentHasMore =
        trendingData.pagination?.hasMore ?? newCasts.length === limit;
    }
  }

  // Transform the casts to ensure compatibility with our components
  const transformedCasts = newCasts.map((cast) => {
    // Handle embeds safely
    let embedsValue = "[]"; // Default to empty array

    if (cast.embeds) {
      if (typeof cast.embeds === "string") {
        embedsValue = cast.embeds;
      } else {
        try {
          embedsValue = JSON.stringify(cast.embeds);
        } catch (e) {
          console.warn("Failed to stringify embeds for cast:", cast.hash, e);
          embedsValue = "[]";
        }
      }
    }

    return {
      ...cast,
      embeds: embedsValue,
    };
  });

  return {
    casts: transformedCasts,
    hasMore: currentHasMore,
    offset: offset + transformedCasts.length,
  };
};

export const useFeed = ({
  fid,
  limit = 20,
  useTrending = false,
}: UseFeedOptions = {}) => {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["feed", fid, limit, useTrending],
    queryFn: ({ pageParam = 0 }) =>
      fetchFeedPage(fid, limit, pageParam, useTrending),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.offset : undefined,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Flatten the paginated data
  const flattenedData = data?.pages.flatMap((page) => page.casts) || [];

  return {
    data: flattenedData,
    loading: isLoading,
    error: error?.message || null,
    hasMore: hasNextPage,
    loadMore: fetchNextPage,
    refresh: refetch,
    isFetchingNextPage,
    isFetching,
  };
};
