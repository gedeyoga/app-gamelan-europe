const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True bila identifier berbentuk UUID (detail route menerima id ATAU slug). */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}
