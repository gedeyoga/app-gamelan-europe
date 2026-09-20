/**
 * Domain: API Key — akses data backend via header `x-api-key`.
 * DB hanya menyimpan hash; field `key` (raw) hanya ada di response POST create.
 */

export interface ApiKey {
  id: string
  name: string
  /** Awalan key yang ditampilkan (masked). */
  prefix: string
  /** Kode permission `resource:action` milik key. */
  permissions: string[]
  lastUsedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

/** Response create — satu-satunya tempat `key` (raw) tersedia. */
export interface CreatedApiKey extends ApiKey {
  key: string
}

export interface CreateApiKeyInput {
  name: string
  permissionCodes: string[]
}

export interface UpdateApiKeyInput {
  name?: string
  permissionCodes?: string[]
}

export type ApiKeySortField = 'name' | 'prefix' | 'lastUsedAt' | 'createdAt'

// Kolom tabel yang sortable server-side (kolom permissions berupa array — tidak disortir).
export const API_KEY_SORTABLE_FIELDS: readonly ApiKeySortField[] = [
  'name',
  'prefix',
  'lastUsedAt',
  'createdAt',
]
