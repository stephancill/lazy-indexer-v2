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
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

export const useTargets = (params: TargetsParams = {}) => {
  return useQuery({
    queryKey: ["targets", params],
    queryFn: async (): Promise<TargetsResponse> => {
      const response = await api.admin.targets.list(params);
      return response as TargetsResponse;
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
    }: { fid: number; data: { isRoot?: boolean } }) => {
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
