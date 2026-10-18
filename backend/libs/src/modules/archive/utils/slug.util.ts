// Identifier unik URL archive. Non-alnum → '-'; seluruhnya non-alnum → fallback 'archive'.
export function slugify(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'archive'
  );
}
