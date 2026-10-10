// Slug diturunkan deterministik dari `name` (idempotent: nama sama → slug sama).
// ponytail: hasil kosong (mis. nama "!!!") diserahkan ke validasi zod `name`; tambah fallback bila backend butuh.
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
    .replace(/-+$/, '')
}
