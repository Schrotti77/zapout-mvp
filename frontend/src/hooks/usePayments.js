/**
 * Payment Hooks - React Query hooks for payment data
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

/**
 * Get all payments for the current user
 */
export function usePayments() {
  return useQuery({
    queryKey: ['payments'],
    queryFn: () => api.getPayments(),
    // Don't refetch as often (payments are stable)
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Get a single payment by ID
 */
export function usePayment(id) {
  return useQuery({
    queryKey: ['payment', id],
    queryFn: () => api.getPayment(id),
    enabled: !!id,
  });
}

/**
 * Create a new payment/lightning invoice
 */
export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ amount, description }) => api.createPayment(amount, description),
    onSuccess: () => {
      // Invalidate payments list to refetch
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

/**
 * WebSocket subscription for payment updates
 */
export function usePaymentSubscription(paymentId, onUpdate) {
  useEffect(() => {
    if (!paymentId) return;

    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${
        window.location.host
      }/ws/payments/${paymentId}`
    );

    ws.onmessage = event => {
      const data = JSON.parse(event.data);
      if (data.type === 'payment_update') {
        onUpdate?.(data);
      }
    };

    ws.onerror = error => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [paymentId, onUpdate]);
}
