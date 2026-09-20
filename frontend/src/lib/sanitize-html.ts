import DOMPurify from 'dompurify'

/**
 * Sanitasi HTML dari API/editor sebelum `dangerouslySetInnerHTML`.
 * Memakai default DOMPurify (script/iframe/on* dibuang, tag format umum dipertahankan).
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { FORBID_TAGS: ['style'], FORBID_ATTR: ['style'] })
}
