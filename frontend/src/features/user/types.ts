export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED'

export interface UserRole {
  id: string
  name: string
}

export interface User {
  id: string
  email: string
  fullName: string
  status: UserStatus
  roleId: string | null
  role: UserRole | null
  createdAt: string
  updatedAt: string
}

export interface CreateUserInput {
  email: string
  fullName: string
  password: string
  status?: UserStatus
}

export interface UpdateUserInput {
  email?: string
  fullName?: string
  status?: UserStatus
  password?: string
}

export interface RoleOption {
  id: string
  name: string
}

export type UserSortField = 'fullName' | 'email' | 'status' | 'roleName' | 'createdAt' | 'updatedAt'

// Semua kolom yang ditampilkan di tabel Users wajib sortable (mirror USER_SORT_FIELDS backend).
export const USER_SORTABLE_FIELDS: readonly UserSortField[] = [
  'fullName',
  'email',
  'status',
  'roleName',
  'createdAt',
  'updatedAt',
]