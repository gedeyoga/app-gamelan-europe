import type { NetworkOrganisationType } from '../types'

export const ORGANISATION_TYPES: NetworkOrganisationType[] = [
  'GAMELAN_GROUP',
  'ASSOCIATION',
  'INSTITUTION',
]

export const ACTIVITY_TYPE_OTHER = 'OTHER'

// Nilai disimpan apa adanya (mirror referensi); label lewat i18n.
export const ACTIVITY_TYPE_OPTIONS = [
  { value: 'Gamelan Ensemble', key: 'gamelanEnsemble' },
  { value: 'Dance Group', key: 'danceGroup' },
  { value: 'Theatre / Drama Group', key: 'theatreDrama' },
  { value: 'Music Group', key: 'musicGroup' },
  { value: 'Education / Workshop', key: 'educationWorkshop' },
  { value: 'Research / Academic', key: 'researchAcademic' },
  { value: 'Cultural Institution', key: 'culturalInstitution' },
  { value: ACTIVITY_TYPE_OTHER, key: 'other' },
] as const
