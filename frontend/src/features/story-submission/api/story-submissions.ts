import { request, requestList, type ListResult } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type {
  ApproveStorySubmissionResult,
  StorySubmission,
  StorySubmissionDetail,
} from '../types'

export interface ListStorySubmissionsParams extends ListParams {
  /** Filter generik `filter[<key>]=<value>` (mis. `{ status: 'REQUEST' }`). */
  filter?: Record<string, string>
}

export function listStorySubmissions(
  params: ListStorySubmissionsParams,
): Promise<ListResult<StorySubmission>> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  for (const [key, value] of Object.entries(params.filter ?? {})) {
    search.set(`filter[${key}]`, value)
  }
  return requestList<StorySubmission>(`/story-submissions?${search.toString()}`)
}

export function getStorySubmission(id: string): Promise<StorySubmissionDetail> {
  return request<StorySubmissionDetail>(`/story-submissions/${id}`)
}

export function approveStorySubmission(id: string): Promise<ApproveStorySubmissionResult> {
  return request<ApproveStorySubmissionResult>(`/story-submissions/${id}/approve`, {
    method: 'POST',
  })
}

export function rejectStorySubmission(id: string): Promise<StorySubmission> {
  return request<StorySubmission>(`/story-submissions/${id}/reject`, { method: 'POST' })
}
