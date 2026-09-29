import { request, requestList } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { CreateUserInput, UpdateUserInput, User } from '../types'

export type ListUsersParams = ListParams

export interface UserListResult {
  items: User[]
  page: number
  limit: number
  total: number
}

export function listUsers(params: ListUsersParams): Promise<UserListResult> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  return requestList<User>(`/users?${search.toString()}`)
}

export function createUser(payload: CreateUserInput): Promise<User> {
  return request<User>('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateUser(id: string, payload: UpdateUserInput): Promise<User> {
  return request<User>(`/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export interface DeleteUserOptions {
  /** Hapus juga semua story/event/archive di mana user ini terdaftar sebagai author (admin only). */
  cascadeContent?: boolean
}

export function deleteUser(id: string, options?: DeleteUserOptions): Promise<User> {
  const query = options?.cascadeContent ? '?cascadeContent=true' : ''
  return request<User>(`/users/${id}${query}`, { method: 'DELETE' })
}

export function assignRole(userId: string, roleId: string): Promise<User> {
  return request<User>(`/users/${userId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId }),
  })
}