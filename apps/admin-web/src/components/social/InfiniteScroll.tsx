import { useEffect, useRef, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReactNode } from "react";

interface InfiniteScrollProps<T> {
  data: T[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  renderItem: (item: T) => ReactNode;
  skeleton?: ReactNode;
}

const DefaultSkeleton = () => (
  <div className="space-y-4 p-3 md:p-4">
    <div className="flex space-x-3">
      <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 sm:h-4 w-24 sm:w-32" />
        <Skeleton className="h-3 sm:h-4 w-full" />
        <Skeleton className="h-3 sm:h-4 w-3/4" />
      </div>
    </div>
    <div className="flex space-x-3">
      <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 sm:h-4 w-24 sm:w-32" />
        <Skeleton className="h-3 sm:h-4 w-full" />
        <Skeleton className="h-3 sm:h-4 w-3/4" />
      </div>
    </div>
    <div className="flex space-x-3">
      <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 sm:h-4 w-24 sm:w-32" />
        <Skeleton className="h-3 sm:h-4 w-full" />
        <Skeleton className="h-3 sm:h-4 w-3/4" />
      </div>
    </div>
  </div>
);

const InfiniteScroll = <T,>({
  data,
  loading,
  hasMore,
  loadMore,
  renderItem,
  skeleton = <DefaultSkeleton />,
}: InfiniteScrollProps<T>) => {
  const observerRef = useRef<HTMLDivElement>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loading) {
        loadMore();
      }
    },
    [hasMore, loading, loadMore]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.1,
    });

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [handleIntersection]);

  return (
    <div className="space-y-0">
      {data.map(renderItem)}

      {loading && skeleton}

      {hasMore && (
        <div
          ref={observerRef}
          className="h-10 flex items-center justify-center"
        >
          {/* Trigger area for infinite scroll */}
        </div>
      )}

      {!hasMore && data.length > 0 && (
        <div className="text-center py-6 sm:py-8 text-gray-500 px-4">
          <p className="text-sm">No more items to load</p>
        </div>
      )}
    </div>
  );
};

export default InfiniteScroll;
