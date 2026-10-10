/**
 * Format input harga gaya `en`: pemisah ribuan koma, desimal titik, maks 2 desimal.
 * Comma selalu dianggap pemisah ribuan; titik adalah pemisah desimal.
 */
export function formatPriceInput(value: string): string {
  const cleaned = value.replace(/[^\d.,]/g, '')
  const dotIndex = cleaned.lastIndexOf('.')
  const intRaw = dotIndex >= 0 ? cleaned.slice(0, dotIndex) : cleaned
  const decRaw = dotIndex >= 0 ? cleaned.slice(dotIndex + 1) : ''

  const intDigits = intRaw.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  const decDigits = decRaw.replace(/\D/g, '').slice(0, 2)
  const grouped = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  if (dotIndex >= 0) return `${grouped || '0'}.${decDigits}`
  return grouped
}

/** Parse nilai terformat `en` → number. Kosong/invalid → NaN. */
export function parsePriceInput(formatted: string): number {
  const normalized = formatted.replace(/,/g, '')
  if (normalized === '' || normalized === '.') return Number.NaN
  const n = Number(normalized)
  return Number.isFinite(n) ? n : Number.NaN
}

// ponytail: belum ada test runner di frontend. Self-check manual:
// formatPriceInput('1000000.5') === '1,000,000.5'; formatPriceInput('1,000,000.50') === '1,000,000.50';
// formatPriceInput('1000000.555') === '1,000,000.55'; parsePriceInput('1,000,000.50') === 1000000.5;
// parsePriceInput('') === NaN; parsePriceInput('abc') === NaN.
