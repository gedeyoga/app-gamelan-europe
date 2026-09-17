// Re-export dari source-of-truth di `src/lib/` agar tidak ada import
// lintas-fitur (`@/features/auth/*` dari fitur lain dilarang AGENTS.md).
// Path lama ini dipertahankan untuk kompatibilitas.
export { mapApiFieldErrors } from '@/lib/field-errors';
