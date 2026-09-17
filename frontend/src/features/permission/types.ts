export interface Permission {
  id: string
  code: string
  description?: string | null
  createdAt?: string
  updatedAt?: string
}

export type PermissionSortField = 'code' | 'description' | 'createdAt' | 'updatedAt'

// Semua kolom yang ditampilkan di tabel Permission wajib sortable (mirror PERMISSION_SORT_FIELDS backend).
export const PERMISSION_SORTABLE_FIELDS: readonly PermissionSortField[] = [
  'code',
  'description',
  'createdAt',
  'updatedAt',
]