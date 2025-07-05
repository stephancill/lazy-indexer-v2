import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ClientTarget } from '../types';

interface ClientTargetsResponse {
  clientTargets: ClientTarget[];
}

export const useClientTargets = () => {
  return useQuery({
    queryKey: ['client-targets'],
    queryFn: async (): Promise<ClientTargetsResponse> => {
      const response = await api.admin.clientTargets.list();
      return response as ClientTargetsResponse;
    },
  });
};

export const useCreateClientTarget = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (fid: number) => {
      return api.admin.clientTargets.create(fid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-targets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useDeleteClientTarget = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (fid: number) => {
      return api.admin.clientTargets.delete(fid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-targets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};