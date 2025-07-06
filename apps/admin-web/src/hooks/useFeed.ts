import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Cast } from "@/types";

interface UseFeedOptions {
  fid?: number;
  limit?: number;
  autoLoad?: boolean;
  useTrending?: boolean; // Fallback to trending if no feed data
}

export const useFeed = ({
  fid,
  limit = 20,
  autoLoad = true,
  useTrending = false,
}: UseFeedOptions = {}) => {
  const [data, setData] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
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
              console.warn(
                "Failed to stringify embeds for cast:",
                cast.hash,
                e
              );
              embedsValue = "[]";
            }
          }
        }

        return {
          ...cast,
          embeds: embedsValue,
        };
      });

      if (offset === 0) {
        setData(transformedCasts);
      } else {
        setData((prev) => [...prev, ...transformedCasts]);
      }

      setHasMore(currentHasMore);
      setOffset(offset + transformedCasts.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, offset, limit, fid, useTrending]);

  const refresh = useCallback(async () => {
    setData([]);
    setHasMore(true);
    setOffset(0);
    setError(null);
    setLoading(false);
    await loadMore();
  }, [loadMore]);

  useEffect(() => {
    if (autoLoad && data.length === 0 && !loading) {
      loadMore();
    }
  }, [autoLoad, data.length, loading, loadMore]);

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
};
