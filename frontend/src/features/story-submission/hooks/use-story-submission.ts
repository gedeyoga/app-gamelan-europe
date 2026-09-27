import { useQuery } from '@tanstack/react-query'

import { getStorySubmission } from '../api/story-submissions'

/** Detail satu usulan story (admin). `enabled: false` → query idle (dialog tertutup). */
export function useStorySubmission(id: string, enabled = true) {
  return useQuery({
    queryKey: ['story-submission', { id }],
    queryFn: () => getStorySubmission(id),
    enabled: enabled && Boolean(id),
    staleTime: 30_000,
  })
}
