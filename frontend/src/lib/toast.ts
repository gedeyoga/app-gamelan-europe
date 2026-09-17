import { toast } from 'sonner'

import { ApiError, isValidationError } from '@/lib/api-client'

export { isValidationError }

const TOAST_DURATION_MS = 4000

export function toastSuccess(msg: string): void {
  toast.success(msg, { duration: TOAST_DURATION_MS })
}

export function toastError(msg: string): void {
  toast.error(msg, { duration: TOAST_DURATION_MS })
}

/**
 * Ambil pesan error dari `ApiError.message`.
 * Kembalikan `fallback` (string i18n dari caller) bila bukan `ApiError`
 * atau `message` kosong.
 *
 * Jangan panggil untuk error validasi 422 — cek dulu
 * `if (isValidationError(err)) return;` agar 422 tampil per-field
 * via `form.setError` tanpa toast sonner.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const message = error.message.trim()
    if (message.length > 0) return message
  }
  return fallback
}
