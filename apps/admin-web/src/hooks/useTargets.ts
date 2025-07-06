import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Target } from "../types";

interface TargetsParams {
  page?: number;
  limit?: number;
  search?: string;
  unsynced?: boolean;
  isRoot?: boolean;
}

interface TargetsResponse {
  targets: Target[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  summary: {
    total: number;
    synced: number;
    unsynced: number;
    waiting: number;
    root: number;
  };
  filters: {
    search: string;
    isRoot: string;
    syncStatus: string;
    sortBy: string;
    sortOrder: string;
  };
}

interface FrontendTargetsResponse {
  targets: Target[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

export const useTargets = (params: TargetsParams = {}) => {
  return useQuery({
    queryKey: ["targets", params],
    queryFn: async (): Promise<FrontendTargetsResponse> => {
      const response = await api.admin.targets.list(params);
      const data = response as TargetsResponse;

      // Convert backend pagination to frontend format
      const limit = params.limit || 20;
      const page = params.page || 1;
      const totalPages = Math.ceil(data.pagination.total / limit);

      return {
        targets: data.targets,
        total: data.pagination.total,
        totalPages,
        page,
        limit,
      };
    },
  });
};

export const useTarget = (fid: number) => {
  return useQuery({
    queryKey: ["target", fid],
    queryFn: async (): Promise<Target> => {
      const response = await api.admin.targets.get(fid);
      return response as Target;
    },
    enabled: !!fid,
  });
};

export const useCreateTarget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { fid: number; isRoot: boolean }) => {
      return api.admin.targets.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["targets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const useUpdateTarget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fid,
      data,
    }: {
      fid: number;
      data: { isRoot?: boolean };
    }) => {
      return api.admin.targets.update(fid, data);
    },
    onSuccess: (_, { fid }) => {
      queryClient.invalidateQueries({ queryKey: ["targets"] });
      queryClient.invalidateQueries({ queryKey: ["target", fid] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const useDeleteTarget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fid: number) => {
      return api.admin.targets.delete(fid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["targets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const useBackfillTarget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fid: number) => {
      return api.admin.targets.backfill(fid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["targets"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
};

export const useTargetStats = (fid: number) => {
  return useQuery({
    queryKey: ["target-stats", fid],
    queryFn: async () => {
      const response = await api.admin.targets.stats(fid);
      return response;
    },
    enabled: !!fid,
  });
};
