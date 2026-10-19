import type { CreateNetworkInput, NetworkOrganisationType, NetworkSocialMedia } from '../types'
import { ACTIVITY_TYPE_OTHER } from './constants'
import type { NetworkFormValues } from './schema'

export function buildNetworkPayload(values: NetworkFormValues): CreateNetworkInput {
  // Baris sosial media kosong (platform & url kosong) di-strip sebelum submit.
  const socialMedia: NetworkSocialMedia[] = values.socialMedia
    .map((row) => ({ platform: row.platform.trim(), url: row.url.trim() }))
    .filter((row) => row.platform.length > 0 && row.url.length > 0)

  // `OTHER` → teks bebas `activityTypeOther` (mirror payload submission publik).
  const activityType =
    values.activityType === ACTIVITY_TYPE_OTHER
      ? values.activityTypeOther.trim()
      : values.activityType.trim()

  // Geo dikirim sebagai ID numerik, di-omit saat kosong (mirror submission publik).
  const geo = {
    ...(values.countryId ? { countryId: Number(values.countryId) } : {}),
    ...(values.stateId ? { stateId: Number(values.stateId) } : {}),
    ...(values.cityId ? { cityId: Number(values.cityId) } : {}),
  }

  // Field opsional dikirim `null` eksplisit saat kosong (backend map null → clear), bukan di-omit.
  return {
    name: values.name,
    organisationType: values.organisationType
      ? (values.organisationType as NetworkOrganisationType)
      : null,
    ledBy: values.ledBy.trim() || null,
    ...geo,
    address: values.address ? values.address : null,
    website: values.website ? values.website : null,
    mapsUrl: values.mapsUrl ? values.mapsUrl : null,
    contact: values.contact ? values.contact : null,
    socialMedia: socialMedia.length > 0 ? socialMedia : null,
    activityType: activityType || null,
    content: values.content ? values.content : null,
    submitterEmail: values.submitterEmail.trim() || null,
  }
}
