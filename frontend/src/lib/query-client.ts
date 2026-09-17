import { QueryClient } from '@tanstack/react-query'

import { ApiError } from './api-client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        const statusCode = error instanceof ApiError ? error.statusCode : undefined
        // 401 → redirect login via api-client; 403 → forbidden, tampilkan empty-state tanpa retry.
        if (statusCode === 401 || statusCode === 403) return false
        return failureCount < 1
      },
      refetchOnWindowFocus: false,
    },
  },
})
