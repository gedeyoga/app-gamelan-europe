/** Format ukuran file ringkas (B/KB/MB). `null`/invalid → `—`. */
export function formatFileSize(size: number | null): string {
  if (size === null || !Number.isFinite(size)) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
