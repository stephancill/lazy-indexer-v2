import { useQuery } from "@tanstack/react-query";

export interface User {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  bio: string;
  custodyAddress: string;
  syncedAt: string;
  stats: {
    casts: number;
    followers: number;
    following: number;
  };
}

interface UserResponse {
  user: User;
}

const fetchUser = async (fid: number): Promise<User> => {
  const response = await fetch(`http://localhost:3000/api/v1/users/${fid}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`);
  }

  const data: UserResponse = await response.json();
  return data.user;
};

export const useUser = (fid: number) => {
  return useQuery({
    queryKey: ["user", fid],
    queryFn: () => fetchUser(fid),
    enabled: Boolean(fid),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};
