/**
 * React Query Client - Server State Management
 * Following fullstack-dev: React Query for server state, automatic caching and refetching
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toast } from '../components/ui/ErrorBanner.jsx';
import { ApiError } from './api.js';

/**
 * Create query client with default options
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time: 5 minutes for most data
        staleTime: 1000 * 60 * 5,
        // Cache time: 10 minutes
        gcTime: 1000 * 60 * 10,
        // Retry failed requests 3 times with exponential backoff
        retry: (failureCount, error) => {
          // Don't retry 4xx errors (client errors)
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 3;
        },
        // Refetch on window focus for important data
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Handle mutation errors globally
        onError: error => {
          console.error('Mutation error:', error);
          // Toast handled in component
        },
      },
    },
  });
}

/**
 * QueryClientProvider wrapper with toast support
 */
export function QueryProvider({ children }) {
  const [toast, setToast] = useState(null);

  const queryClient = createQueryClient();

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
  };

  const hideToast = () => {
    setToast(null);
  };

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {toast && <Toast {...toast} onClose={hideToast} />}
    </QueryClientProvider>
  );
}

// Re-export toast helper for use in components
export function useToast() {
  // This is a simple implementation
  // For more complex toast management, consider using a library like react-hot-toast
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = id => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return { toasts, addToast, removeToast };
}
