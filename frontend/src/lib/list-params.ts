// Helper + type kontrak list CRUD (search + sort server-side).
// Dipakai semua feature api/hooks agar serialisasi query seragam dengan backend RULES Bab 19/19a/19b.

export type ListSortOrder = 'asc' | 'desc'

export interface ListParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
}

// Cycle klik header: asc → desc → null (kembali ke default backend createdAt desc).
export function nextSort(
  currentBy: string | null,
  currentOrder: ListSortOrder | null,
  field: string,
): { sortBy: string | null; sortOrder: ListSortOrder | null } {
  if (currentBy !== field) return { sortBy: field, sortOrder: 'asc' }
  if (currentOrder === 'asc') return { sortBy: field, sortOrder: 'desc' }
  return { sortBy: null, sortOrder: null }
}

// Serialisasi search/sort ke URLSearchParams.
// search dikirim hanya bila trim ≥2 char (backend mengabaikan <2, cegah full-scan 1 huruf).
export function appendListParams(params: URLSearchParams, list: ListParams): void {
  params.set('page', String(list.page))
  params.set('limit', String(list.limit))
  const term = (list.search ?? '').trim()
  if (term.length >= 2) params.set('search', term)
  if (list.sortBy && list.sortOrder) {
    params.set('sortBy', list.sortBy)
    params.set('sortOrder', list.sortOrder)
  }
}
