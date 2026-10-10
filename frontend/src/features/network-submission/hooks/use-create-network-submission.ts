import { useMutation } from '@tanstack/react-query'

import { createNetworkSubmission } from '../api/network-submissions'

// Tanpa invalidate: tidak ada list submission publik.
export function useCreateNetworkSubmission() {
  return useMutation({ mutationFn: createNetworkSubmission })
}
