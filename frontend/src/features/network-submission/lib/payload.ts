import type {
  CreateNetworkSubmissionInput,
  NetworkOrganisationType,
  NetworkSubmissionSocialMedia,
} from '../types'
import { ACTIVITY_TYPE_OTHER } from '@/features/network/lib/constants'
import type { NetworkSubmissionFormValues } from './schema'

// Helper bersama: strip baris sosial kosong + resolve activityType (OTHER → teks bebas).
function resolveSocialMedia(values: NetworkSubmissionFormValues): NetworkSubmissionSocialMedia[] {
  return values.socialMedia
    .map((row) => ({ platform: row.platform.trim(), url: row.url.trim() }))
    .filter((row) => row.platform.length > 0 && row.url.length > 0)
}

function resolveActivityType(values: NetworkSubmissionFormValues): string {
  return values.activityType === ACTIVITY_TYPE_OTHER
    ? values.activityTypeOther.trim()
    : values.activityType.trim()
}

export function buildNetworkSubmissionPayload(
  values: NetworkSubmissionFormValues,
): CreateNetworkSubmissionInput {
  const socialMedia = resolveSocialMedia(values)
  const activityType = resolveActivityType(values)

  // Field opsional kosong di-omit (backend whitelist additionalProperties:false).
  const payload: CreateNetworkSubmissionInput = {
    organisationType: values.organisationType as NetworkOrganisationType,
    name: values.name.trim(),
    countryId: Number(values.countryId),
    contact: values.contact.trim(),
    content: values.content,
    submitter: {
      fullName: values.submitter.fullName.trim(),
      email: values.submitter.email.trim(),
      countryId: Number(values.submitter.countryId),
      ...(values.submitter.stateId.trim()
        ? { stateId: Number(values.submitter.stateId) }
        : {}),
    },
  }

  if (values.ledBy.trim()) payload.ledBy = values.ledBy.trim()
  if (values.stateId.trim()) payload.stateId = Number(values.stateId)
  if (values.address.trim()) payload.address = values.address.trim()
  if (values.mapsUrl.trim()) payload.mapsUrl = values.mapsUrl.trim()
  if (values.website.trim()) payload.website = values.website.trim()
  if (socialMedia.length > 0) payload.socialMedia = socialMedia
  if (activityType) payload.activityType = activityType

  return payload
}
