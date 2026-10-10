/**
 * Format jumlah + kode mata uang: `1,234.5 IDR`; currency kosong → hanya angka.
 * Satu-satunya formatter uang billing (dipakai tabel + ringkasan my-billings).
 */
export function formatMoney(value: number, currency: string): string {
  const amount = value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return currency ? `${amount} ${currency}` : amount
}
