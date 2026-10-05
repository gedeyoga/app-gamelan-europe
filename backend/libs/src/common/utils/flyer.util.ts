import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Satu grup flyer bertipe. `type` = teks bebas (id stabil preset atau custom); urutan array = urutan grup.
export type FlyerItem = { type: string; imageIds: string[] };

// Tipe unik (case-insensitive) & id gambar unik (dalam/antar grup) → 422 per-field.
// Satu definisi dipakai `Post` (jangan bercabang).
export function assertUniqueFlyerItems(items?: ReadonlyArray<FlyerItem> | null): void {
  if (!items) return;
  const types = new Set<string>();
  const imageIds = new Set<string>();
  items.forEach((item, i) => {
    const key = item.type.toLowerCase();
    if (types.has(key)) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        errors: [{ field: `flyerItems.${i}.type`, message: 'flyer type must be unique' }],
      });
    }
    types.add(key);
    item.imageIds.forEach((id, j) => {
      if (imageIds.has(id)) {
        throw new UnprocessableEntityException({
          message: 'Validation failed',
          errors: [{ field: `flyerItems.${i}.imageIds.${j}`, message: 'image id must be unique' }],
        });
      }
      imageIds.add(id);
    });
  });
}

// Kolom Json tidak dipercaya buta: validasi bentuk minimal sebelum dipakai.
export function normalizeFlyerItems(value: Prisma.JsonValue): FlyerItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const { type, imageIds } = item as { type?: unknown; imageIds?: unknown };
    if (typeof type !== 'string' || !Array.isArray(imageIds)) return [];
    const trimmed = type.trim();
    if (trimmed === '') return [];
    return [{ type: trimmed, imageIds: imageIds.filter((id): id is string => typeof id === 'string') }];
  });
}
