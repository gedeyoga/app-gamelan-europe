import type { ApiError } from './api-client';

interface ApiFieldError {
  field?: string;
  path?: string;
  property?: string;
  message?: string;
}

function isFieldError(value: unknown): value is ApiFieldError {
  if (typeof value !== 'object' || value === null) return false;
  return 'message' in value;
}

function isFieldErrorArray(value: unknown): value is ApiFieldError[] {
  return Array.isArray(value) && value.every(isFieldError);
}

function isFieldErrorMap(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).every((v) => typeof v === 'string');
}

/**
 * Petakan `ApiError.errors` backend menjadi `{ [field]: message }` untuk
 * react-hook-form / `FormMessage`. Helper shared — tinggal di `src/lib/`
 * agar bisa dipakai lintas fitur tanpa import `@/features/*`.
 */
export function mapApiFieldErrors(error: ApiError): Record<string, string> {
  const errors = error.errors;

  if (isFieldErrorArray(errors)) {
    const result: Record<string, string> = {};
    for (const item of errors) {
      const key = item.field ?? item.path ?? item.property;
      if (key && item.message) result[key] = item.message;
    }
    return result;
  }

  if (isFieldErrorMap(errors)) {
    return errors;
  }

  return {};
}
