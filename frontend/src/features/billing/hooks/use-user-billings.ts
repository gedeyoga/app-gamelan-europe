import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { listUserBillings } from '../api/user-billings'

export interface UseUserBillingsParams {
  /** `null` = tidak ada user terpilih → query di-disable. */
  userId: string | null
  page: number
  limit: number
}

export function useUserBillings({ userId, page, limit }: UseUserBillingsParams) {
  return useQuery({
    queryKey: ['user-billings', { userId, page, limit }],
    queryFn: () => {
      if (!userId) return Promise.reject(new Error('userId is required'))
      return listUserBillings({ userId, page, limit })
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled: Boolean(userId),
  })
}
