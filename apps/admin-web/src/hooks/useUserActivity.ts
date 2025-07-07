import { useInfiniteQuery } from "@tanstack/react-query";

export interface UserActivityOptions {
  fid: number;
  type: "casts" | "replies" | "likes" | "followers" | "following";
  limit?: number;
}

export interface UserActivityResponse {
  data: any[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export interface UserActivityPage {
  data: any[];
  hasMore: boolean;
  offset: number;
}

const fetchUserActivityPage = async (
  fid: number,
  type: "casts" | "replies" | "likes" | "followers" | "following",
  limit: number,
  offset: number
): Promise<UserActivityPage> => {
  const response = await fetch(
    `http://localhost:3000/api/v1/users/${fid}/${type}?limit=${limit}&offset=${offset}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch user ${type}: ${response.status}`);
  }

  const data = await response.json();

  // Normalize the response structure based on activity type
  let normalizedData: any[] = [];

  switch (type) {
    case "casts":
      normalizedData = data.casts || [];
      break;
    case "replies":
      normalizedData = data.replies || [];
      break;
    case "likes":
      normalizedData = data.likes || [];
      break;
    case "followers":
      normalizedData = data.followers || [];
      break;
    case "following":
      normalizedData = data.following || [];
      break;
    default:
      normalizedData = [];
  }

  return {
    data: normalizedData,
    hasMore: data.pagination?.hasMore ?? normalizedData.length === limit,
    offset: offset + normalizedData.length,
  };
};

export const useUserActivity = ({
  fid,
  type,
  limit = 20,
}: UserActivityOptions) => {
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
    queryKey: ["userActivity", fid, type, limit],
    queryFn: ({ pageParam = 0 }) =>
      fetchUserActivityPage(fid, type, limit, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.offset : undefined,
    enabled: Boolean(fid && type),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Flatten the paginated data
  const flattenedData = data?.pages.flatMap((page) => page.data) || [];

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
