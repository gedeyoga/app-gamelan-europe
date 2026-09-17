export interface Role {
  id: string
  name: string
  code: string
  description?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface CreateRoleInput {
  name: string
  description?: string
}

export interface UpdateRoleInput {
  name?: string
  description?: string
}

export interface RolePermission {
  roleId: string
  permissionId: string
  permission: { id: string; code: string; description: string | null }
}

export type RoleSortField = 'name' | 'description' | 'createdAt' | 'updatedAt'

// Semua kolom yang ditampilkan di tabel Roles wajib sortable (mirror ROLE_SORT_FIELDS backend).
export const ROLE_SORTABLE_FIELDS: readonly RoleSortField[] = [
  'name',
  'description',
  'createdAt',
  'updatedAt',
]