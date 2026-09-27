import { request, requestList, type ListResult } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { ApproveArchiveSubmissionResult, ArchiveSubmission } from '../types'

export interface ListArchiveSubmissionsParams extends ListParams {
  /** Filter generik `filter[<key>]=<value>` (mis. `{ status: 'REQUEST' }`). */
  filter?: Record<string, string>
}

export function listArchiveSubmissions(
  params: ListArchiveSubmissionsParams,
): Promise<ListResult<ArchiveSubmission>> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  for (const [key, value] of Object.entries(params.filter ?? {})) {
    search.set(`filter[${key}]`, value)
  }
  return requestList<ArchiveSubmission>(`/archive-submissions?${search.toString()}`)
}

export function approveArchiveSubmission(id: string): Promise<ApproveArchiveSubmissionResult> {
  return request<ApproveArchiveSubmissionResult>(`/archive-submissions/${id}/approve`, {
    method: 'POST',
  })
}

export function rejectArchiveSubmission(id: string): Promise<ArchiveSubmission> {
  return request<ArchiveSubmission>(`/archive-submissions/${id}/reject`, { method: 'POST' })
}
