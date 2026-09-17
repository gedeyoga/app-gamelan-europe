// Re-export dari source-of-truth di `src/i18n/` agar tidak ada duplikasi logic.
// Path lama ini dipertahankan untuk kompatibilitas impor yang sudah ada.
export { useLanguage, type UseLanguageResult } from '@/i18n/use-language';
