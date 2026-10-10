export const ACCEPTED_PROOF_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const
// Sebagian browser melaporkan `file.type === ''`; fallback via ekstensi nama file.
export const ACCEPTED_PROOF_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp'] as const
export const MAX_PROOF_BYTES = 10 * 1024 * 1024

export function isAcceptedProofFile(file: File): boolean {
  if (ACCEPTED_PROOF_MIME.includes(file.type as (typeof ACCEPTED_PROOF_MIME)[number])) {
    return true
  }
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext != null && (ACCEPTED_PROOF_EXT as readonly string[]).includes(ext)
}
