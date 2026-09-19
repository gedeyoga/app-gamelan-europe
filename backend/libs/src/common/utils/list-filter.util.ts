import { UnprocessableEntityException } from '@nestjs/common';

export interface ListFilterOptions {
  enumFields?: Record<string, string[]>;
  mapFields?: Record<string, string>;
  dateFields?: string[];
  numberFields?: string[];
}

const OPERATORS = new Set(['eq', 'ne', 'in', 'like', 'gt', 'gte', 'lt', 'lte']);

export function parseDateInput(value: unknown, rawKey: string): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new UnprocessableEntityException(`Invalid ISO 8601 date for filter field "${rawKey}"`);
    }
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new UnprocessableEntityException(`Invalid ISO 8601 date for filter field "${rawKey}"`);
    }
    return parsed;
  }
  throw new UnprocessableEntityException(`Invalid ISO 8601 date for filter field "${rawKey}"`);
}

export function parseNumberInput(value: unknown, rawKey: string): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  // Caller (saat ini) hanya untuk kolom Prisma `Int` 32-bit. Nilai dikonversi via Number:
  // bentuk integral seperti '1.0', '1e3', '0x10' diterima; non-integer (1.5), array,
  // whitespace, non-numerik, dan nilai di luar rentang Int32 ditolak 422.
  if (!Number.isInteger(parsed) || parsed < -2147483648 || parsed > 2147483647) {
    throw new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [{ field: rawKey, message: `filter[${rawKey}] must be a 32-bit integer` }],
    });
  }
  return parsed;
}

export function buildWhere<W>(
  filter: Record<string, unknown> | undefined,
  allowedFields: string[],
  options: ListFilterOptions = {},
): W {
  const where: Record<string, unknown> = {};
  if (!filter) return where as unknown as W;

  for (const [rawKey, rawValue] of Object.entries(filter)) {
    if (rawValue === null || rawValue === undefined) continue;

    const field = options.mapFields?.[rawKey] ?? rawKey;
    if (!allowedFields.includes(field)) {
      throw new UnprocessableEntityException(`Filter field "${rawKey}" is not allowed`);
    }

    let op = 'eq';
    let value: unknown = rawValue;

    if (typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      const entries = Object.entries(rawValue as Record<string, unknown>).filter(
        ([, v]) => v !== null && v !== undefined,
      );
      if (entries.length > 0) {
        const [firstOp, firstValue] = entries[0];
        op = firstOp;
        value = firstValue;
        if (entries.length > 1) {
          throw new UnprocessableEntityException(`Multiple operators for "${rawKey}" is not allowed`);
        }
      }
    }

    if (!OPERATORS.has(op)) {
      throw new UnprocessableEntityException(`Operator "${op}" is not allowed for "${rawKey}"`);
    }

    // Aturan koersi tanggal: field di `dateFields` dikoersi ke Date via parseDateInput.

    if (op === 'like') {
      if (typeof value !== 'string') {
        throw new UnprocessableEntityException(`Operator "like" only supports string values for "${rawKey}"`);
      }
    }

    let effectiveValue = value;
    if (op === 'in') {
      effectiveValue = Array.isArray(value)
        ? value
        : String(value).split(',').map((s) => s.trim()).filter(Boolean);
    }

    const isEmpty =
      effectiveValue === '' ||
      (Array.isArray(effectiveValue) && effectiveValue.length === 0) ||
      effectiveValue === null ||
      effectiveValue === undefined;
    if (isEmpty) continue;

    // Koersi tanggal: field di `dateFields` selalu jadi Date; `like` ditolak (hanya string).
    if (options.dateFields?.includes(field)) {
      if (op === 'like') {
        throw new UnprocessableEntityException(`Operator "like" is not allowed for date field "${rawKey}"`);
      }
      if (op === 'in') {
        effectiveValue = (effectiveValue as unknown[]).map((v) => parseDateInput(v, rawKey));
      } else {
        effectiveValue = parseDateInput(effectiveValue, rawKey);
      }
    }

    // Koersi angka: field di `numberFields` selalu jadi number; `like` ditolak (hanya string).
    if (options.numberFields?.includes(field)) {
      if (op === 'like') {
        throw new UnprocessableEntityException(`Operator "like" is not allowed for number field "${rawKey}"`);
      }
      if (op === 'in') {
        effectiveValue = (effectiveValue as unknown[]).map((v) => parseNumberInput(v, rawKey));
      } else {
        effectiveValue = parseNumberInput(effectiveValue, rawKey);
      }
    }

    const enumAllowed = options.enumFields?.[field];
    if (enumAllowed) {
      const candidates = Array.isArray(effectiveValue) ? effectiveValue : [effectiveValue];
      if (candidates.some((v) => !enumAllowed.includes(String(v)))) {
        throw new UnprocessableEntityException(`Invalid value for filter field "${rawKey}"`);
      }
    }

    const condition = buildCondition(op, effectiveValue);
    const existing = where[field];
    if (
      existing !== undefined &&
      typeof existing === 'object' &&
      !Array.isArray(existing) &&
      typeof condition === 'object' &&
      !Array.isArray(condition)
    ) {
      where[field] = { ...(existing as Record<string, unknown>), ...(condition as Record<string, unknown>) };
    } else {
      where[field] = condition;
    }
  }

  return where as unknown as W;
}

function buildCondition(op: string, value: unknown): unknown {
  switch (op) {
    case 'eq':
      return value;
    case 'ne':
      return { not: value };
    case 'in':
      return { in: value };
    case 'like':
      return { contains: value, mode: 'insensitive' };
    case 'gt':
      return { gt: value };
    case 'gte':
      return { gte: value };
    case 'lt':
      return { lt: value };
    case 'lte':
      return { lte: value };
    default:
      return value;
  }
}

export function assertAllowedSort(sortBy: string | undefined, allowedSortBy: string[]): void {
  if (sortBy && !allowedSortBy.includes(sortBy)) {
    throw new UnprocessableEntityException(`sortBy "${sortBy}" is not allowed`);
  }
}

// Global search bar untuk semua menu CRUD list.
// `search` di-OR-kan sebagai `like` (contains, insensitive) ke `searchableFields`.
// Trim + abaikan bila kosong / <2 char (bukan error) agar FE bisa kirim debounce bebas.
// Return `undefined` bila tidak ada kondisi → service menggabung dengan AND bersama filter.
export function buildSearch<W>(search: string | undefined, searchableFields: string[]): W | undefined {
  const term = (search ?? '').trim();
  if (term.length < 2) return undefined;
  if (searchableFields.length === 0) return undefined;

  const or = searchableFields.map((field) => ({
    [field]: { contains: term, mode: 'insensitive' as const },
  }));
  return { OR: or } as unknown as W;
}

// Gabung kondisi filter (AND) dengan search (AND): [filterWhere, searchWhere].
// Filter kosong + search kosong → {}.
export function combineWhere<W>(
  filterWhere: Record<string, unknown>,
  searchWhere: Record<string, unknown> | undefined,
): W {
  const clauses: Record<string, unknown>[] = [];
  if (Object.keys(filterWhere).length > 0) clauses.push(filterWhere);
  if (searchWhere && Object.keys(searchWhere).length > 0) clauses.push(searchWhere);
  if (clauses.length === 0) return {} as unknown as W;
  if (clauses.length === 1) return clauses[0] as unknown as W;
  return { AND: clauses } as unknown as W;
}

// Mapping sortBy publik (kolom tampil di FE) → orderBy Prisma.
// `mapSort` untuk kolom relasi, mis. { roleName: 'role.name' }.
// Tanpa mapping → `{ [sortBy]: sortOrder }`. Kolom tak dikenal tetap ditolak via assertAllowedSort.
export function buildOrderBy<O>(
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
  mapSort: Record<string, string> = {},
): O {
  const field = sortBy ?? 'createdAt';
  const order = sortOrder ?? 'desc';
  const mapped = mapSort[field] ?? field;

  // Dukung path nested satu level: 'role.name' → { role: { name: order } }.
  if (mapped.includes('.')) {
    const [relation, nested] = mapped.split('.');
    return { [relation]: { [nested]: order } } as unknown as O;
  }
  return { [mapped]: order } as unknown as O;
}