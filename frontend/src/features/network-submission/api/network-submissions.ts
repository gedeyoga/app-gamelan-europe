import { request } from '@/lib/api-client'

import type { CreateNetworkSubmissionInput, NetworkSubmissionResult } from '../types'

export function createNetworkSubmission(
  payload: CreateNetworkSubmissionInput,
): Promise<NetworkSubmissionResult> {
  return request<NetworkSubmissionResult>('/network-submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
