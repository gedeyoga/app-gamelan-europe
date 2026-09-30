import type { CreateNetworkInput, NetworkSocialMedia } from '../types'
import type { NetworkFormValues } from './schema'

export function buildNetworkPayload(values: NetworkFormValues): CreateNetworkInput {
  // Baris sosial media kosong (platform & url kosong) di-strip sebelum submit.
  const socialMedia: NetworkSocialMedia[] = values.socialMedia
    .map((row) => ({ platform: row.platform.trim(), url: row.url.trim() }))
    .filter((row) => row.platform.length > 0 && row.url.length > 0)

  // Field opsional dikirim `null` eksplisit saat kosong (backend map null → clear), bukan di-omit.
  return {
    name: values.name,
    state: values.state ? values.state : null,
    country: values.country ? values.country : null,
    address: values.address ? values.address : null,
    website: values.website ? values.website : null,
    contact: values.contact ? values.contact : null,
    socialMedia: socialMedia.length > 0 ? socialMedia : null,
    lat: values.lat.trim() ? Number(values.lat) : null,
    lng: values.lng.trim() ? Number(values.lng) : null,
    content: values.content ? values.content : null,
  }
}
