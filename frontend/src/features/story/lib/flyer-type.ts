import type { TFunction } from 'i18next'

/**
 * Identifier stabil tipe flyer preset — disimpan sebagai `FlyerGroup.type`, bukan label terjemahan
 * (data tidak boleh bergantung locale; label hanya diterjemahkan saat render).
 */
export const PRESET_TYPES = ['flyer', 'poster', 'banner', 'brosur'] as const

export type FlyerPresetType = (typeof PRESET_TYPES)[number]

/** Id preset bila `type` cocok (case-insensitive); `null` = tipe custom (teks apa adanya). */
export function presetTypeId(type: string): FlyerPresetType | null {
  const needle = type.trim().toLowerCase()
  return PRESET_TYPES.find((key) => key === needle) ?? null
}

/** Label tampil: preset → diterjemahkan via `story:flyer.presets.*`; custom → teks mentah. */
export function labelForType(type: string, t: TFunction): string {
  const id = presetTypeId(type)
  return id ? t(`story:flyer.presets.${id}`) : type
}
