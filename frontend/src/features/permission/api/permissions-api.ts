import { requestList } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { Permission } from '../types'

export type ListPermissionsParams = Partial<ListParams>

export function listPermissions(params: ListPermissionsParams = {}): Promise<{
  items: Permission[]
  page: number
  limit: number
  total: number
}> {
  const search = new URLSearchParams()
  appendListParams(
    search,
    { page: params.page ?? 1, limit: params.limit ?? 100, search: params.search, sortBy: params.sortBy, sortOrder: params.sortOrder },
  )
  return requestList<Permission>(`/permissions?${search.toString()}`)
}