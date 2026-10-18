import { NotificationEntityType, NotificationType } from '@prisma/client';
import sanitizeHtml = require('sanitize-html');
import { escapeHtml } from '@app/libs/common/utils/html.util';

export const NOTIFICATION_EXCERPT_MAX = 300;

const LINK_SEGMENTS: Record<NotificationEntityType, string> = {
  POST: 'stories',
  EVENT: 'events',
  ARCHIVE: 'archives',
  NETWORK: 'networks',
  SUBSCRIPTION_REQUEST: 'subscription-requests',
};

const ENTITY_LABEL: Record<NotificationEntityType, string> = {
  POST: 'Story',
  EVENT: 'Event',
  ARCHIVE: 'Archive',
  NETWORK: 'Network',
  SUBSCRIPTION_REQUEST: 'Subscription',
};

const GREETING =
  "Thank you for being part of the European Gamelan Society. We're writing to keep you up to date with what's happening across the platform.";

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const INK = '#1c1f1c';
const MUTED = '#5c635c';
const HAIRLINE = '#e3e6e1';
const ACCENT = '#1f6146';

// HTML konten → plain text excerpt (tag dibuang, whitespace dirapikan, dipotong).
export function toExcerpt(input: string | null | undefined, max = NOTIFICATION_EXCERPT_MAX): string | null {
  if (!input) return null;
  const text = sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

// Path FE berbasis slug; tanpa slug → null (jangan fallback ke id).
export function buildLinkPath(entityType: NotificationEntityType, slug: string | null | undefined): string | null {
  if (!slug) return null;
  return `/${LINK_SEGMENTS[entityType]}/${encodeURIComponent(slug)}`;
}

export function buildContentUrl(baseUrl: string | undefined, linkPath: string | null): string | null {
  if (!baseUrl || !linkPath) return null;
  return `${baseUrl.replace(/\/+$/, '')}${linkPath}`;
}

// Hanya http(s); nilai lain (javascript:, data:, relatif) → null.
function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

function subject(input: {
  type: NotificationType;
  label: string;
  title: string;
}): string {
  if (input.type === NotificationType.SUBSCRIPTION_REQUEST_SUBMITTED) {
    return `New subscription request: ${input.title}`;
  }
  if (input.type === NotificationType.CONTENT_SUBMITTED) {
    return `New ${input.label} submission: ${input.title}`;
  }
  return `New ${input.label}: ${input.title}`;
}

function sentence(type: NotificationType, label: string): string {
  if (type === NotificationType.SUBSCRIPTION_REQUEST_SUBMITTED) {
    return 'A new subscription request has arrived and is waiting for review.';
  }
  if (type === NotificationType.CONTENT_SUBMITTED) {
    return `A new ${label} submission has arrived and is waiting for review.`;
  }
  return 'A new piece of content has just been published on the EGS platform.';
}

export interface RenderedNotification {
  subject: string;
  text: string;
  html: string;
}

export function renderNotification(input: {
  type?: NotificationType;
  entityType?: NotificationEntityType;
  title: string;
  excerpt?: string | null;
  url?: string | null;
  imageUrl?: string | null;
}): RenderedNotification {
  const type = input.type ?? NotificationType.CONTENT_PUBLISHED;
  const label = ENTITY_LABEL[input.entityType ?? NotificationEntityType.POST];
  const title = input.title;
  const safeTitle = escapeHtml(title);
  const href = safeHttpUrl(input.url);
  const image = safeHttpUrl(input.imageUrl);
  const cta = type === NotificationType.CONTENT_PUBLISHED ? 'Read more' : 'Review submission';
  const intro = sentence(type, label);

  const card = [
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ' +
      HAIRLINE +
      ';border-radius:12px;border-collapse:separate;border-spacing:0;overflow:hidden;">',
    image
      ? `<tr><td style="padding:0;"><img src="${escapeHtml(image)}" alt="${safeTitle}" width="600" style="display:block;width:100%;max-width:600px;height:240px;object-fit:cover;border:0;outline:none;text-decoration:none;" /></td></tr>`
      : '',
    `<tr><td style="padding:24px;">
      <p style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:${ACCENT};">${escapeHtml(label)}</p>
      <p style="margin:0;font-family:${FONT};font-size:20px;line-height:28px;font-weight:700;color:${INK};">${safeTitle}</p>
    </td></tr>`,
    '</table>',
  ].join('');

  const html = [
    '<!doctype html>',
    '<html><body style="margin:0;padding:0;background:#f4f5f3;">',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f3;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
          <tr><td style="padding:0 8px 20px;font-family:${FONT};">
            <p style="margin:0;font-size:16px;line-height:24px;color:${INK};">Hello,</p>
            <p style="margin:8px 0 0;font-size:16px;line-height:24px;color:${MUTED};">${escapeHtml(GREETING)}</p>
            <p style="margin:8px 0 0;font-size:16px;line-height:24px;color:${MUTED};">${escapeHtml(intro)}</p>
          </td></tr>
          <tr><td>${href ? `<a href="${escapeHtml(href)}" style="display:block;color:${INK};text-decoration:none;">${card}</a>` : card}</td></tr>`,
    href
      ? `<tr><td style="padding:24px 8px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="background:${ACCENT};border-radius:8px;">
              <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${cta}</a>
            </td></tr>
          </table>
        </td></tr>`
      : '',
    `<tr><td style="padding:28px 8px 8px;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};">This email was sent automatically by EGS.</td></tr>
        </table>
      </td></tr>
    </table>`,
    '</body></html>',
  ].join('');

  return {
    subject: subject({ type, label, title }),
    text: ['Hello,', GREETING, intro, title, href ?? ''].filter(Boolean).join('\n\n'),
    html,
  };
}
