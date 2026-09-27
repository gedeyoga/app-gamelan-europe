// Sanitasi HTML rich-text dari input anonim (cegah stored-XSS). Allowlist ketat.
// Dipakai di create DAN approve submission (defense in depth).
import sanitizeHtml = require('sanitize-html');

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'code', 'pre', 'hr', 'span',
];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  // Tag lain (script/iframe/object/embed/form/input/...) & atribut tak terdaftar
  // (on*, style, ...) otomatis dibuang.
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https'],
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: 'noopener noreferrer' },
    }),
  },
};

export function sanitizeStoryContent(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}
