import { useQuery } from "@tanstack/react-query";

interface SearchUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  bio: string;
  custodyAddress: string;
  syncedAt: string;
}

interface SearchCast {
  hash: string;
  fid: number;
  text: string;
  parentHash: string | null;
  parentFid: number | null;
  parentUrl: string | null;
  timestamp: string;
  embeds: string;
  mentions: number[] | null;
  mentionsPositions: number[] | null;
  createdAt: string;
  user: SearchUser;
}

interface SearchResults {
  query: string;
  results: {
    users: SearchUser[];
    casts: SearchCast[];
  };
  counts: {
    users: number;
    casts: number;
    total: number;
  };
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

const fetchSearchResults = async (
  query: string,
  limit = 20,
  offset = 0
): Promise<SearchResults> => {
  const response = await fetch(
    `http://localhost:3000/api/v1/search?q=${encodeURIComponent(
      query
    )}&limit=${limit}&offset=${offset}`
  );

  if (!response.ok) {
    throw new Error("Search failed");
  }

  return response.json();
};

export const useSearch = (query: string, limit = 20, offset = 0) => {
  return useQuery({
    queryKey: ["search", query, limit, offset],
    queryFn: () => fetchSearchResults(query, limit, offset),
    enabled: Boolean(query?.trim()),
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });
};
