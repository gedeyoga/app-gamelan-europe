import { request, requestList } from '@/lib/api-client'
import type { ListParams } from '@/lib/list-params'

import type { CreateRoleInput, Role, RolePermission, UpdateRoleInput } from '../types'

export type ListRolesParams = Partial<ListParams>

export function listRoles(params: ListRolesParams = {}): Promise<{
  items: Role[]
  page: number
  limit: number
  total: number
}> {
  const search = new URLSearchParams()
  if (params.page) search.set('page', String(params.page))
  if (params.limit) search.set('limit', String(params.limit))
  const term = (params.search ?? '').trim()
  if (term.length >= 2) search.set('search', term)
  if (params.sortBy && params.sortOrder) {
    search.set('sortBy', params.sortBy)
    search.set('sortOrder', params.sortOrder)
  }
  // Pertahankan default page/limit bila tak dikirim agar kompatibel dengan pemakaian lama.
  if (!params.page && !params.limit && search.toString() === '') {
    return requestList<Role>('/roles?page=1&limit=100')
  }
  const qs = search.toString()
  return requestList<Role>(`/roles${qs ? `?${qs}` : ''}`)
}

export function createRole(payload: CreateRoleInput): Promise<Role> {
  return request<Role>('/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateRole(id: string, payload: UpdateRoleInput): Promise<Role> {
  return request<Role>(`/roles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteRole(id: string): Promise<Role> {
  return request<Role>(`/roles/${id}`, { method: 'DELETE' })
}

export function listRolePermissions(roleId: string): Promise<RolePermission[]> {
  return request<RolePermission[]>(`/roles/${roleId}/permissions`)
}

export function replaceRolePermissions(
  roleId: string,
  permissionIds: string[],
): Promise<RolePermission[]> {
  return request<RolePermission[]>(`/roles/${roleId}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissionIds }),
  })
}