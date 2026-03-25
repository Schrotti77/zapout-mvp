/**
 * Cashu Hooks - React Query hooks for Cashu/eCash data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

/**
 * Get Cashu balance from all mints
 */
export function useCashuBalance() {
  return useQuery({
    queryKey: ['cashu', 'balance'],
    queryFn: () => api.getCashuBalance(),
    // Balance changes frequently, keep fresh
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}

/**
 * Get all configured Cashu mints
 */
export function useMints() {
  return useQuery({
    queryKey: ['cashu', 'mints'],
    queryFn: () => api.getMints(),
  });
}

/**
 * Add a new Cashu mint
 */
export function useAddMint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: url => api.addMint(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashu', 'mints'] });
    },
  });
}

/**
 * Remove a Cashu mint
 */
export function useRemoveMint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: url => api.removeMint(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashu', 'mints'] });
      queryClient.invalidateQueries({ queryKey: ['cashu', 'balance'] });
    },
  });
}
