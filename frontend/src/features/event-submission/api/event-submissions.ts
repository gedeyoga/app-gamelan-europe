import { request, requestList, type ListResult } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { ApproveEventSubmissionResult, EventSubmission } from '../types'

export interface ListEventSubmissionsParams extends ListParams {
  /** Filter generik `filter[<key>]=<value>` (mis. `{ status: 'REQUEST' }`). */
  filter?: Record<string, string>
}

export function listEventSubmissions(
  params: ListEventSubmissionsParams,
): Promise<ListResult<EventSubmission>> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  for (const [key, value] of Object.entries(params.filter ?? {})) {
    search.set(`filter[${key}]`, value)
  }
  return requestList<EventSubmission>(`/event-submissions?${search.toString()}`)
}

export function approveEventSubmission(id: string): Promise<ApproveEventSubmissionResult> {
  return request<ApproveEventSubmissionResult>(`/event-submissions/${id}/approve`, {
    method: 'POST',
  })
}

export function rejectEventSubmission(id: string): Promise<EventSubmission> {
  return request<EventSubmission>(`/event-submissions/${id}/reject`, { method: 'POST' })
}
