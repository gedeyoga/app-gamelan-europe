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
  SUBSCRIPTION: 'my-billings',
};

const ENTITY_LABEL: Record<NotificationEntityType, string> = {
  POST: 'Story',
  EVENT: 'Event',
  ARCHIVE: 'Archive',
  NETWORK: 'Network',
  SUBSCRIPTION_REQUEST: 'Subscription',
  SUBSCRIPTION: 'Membership',
};

// Tipe admin (blok pembuka + CTA review). Sisanya member-facing.
const ADMIN_TYPES: ReadonlySet<NotificationType> = new Set([
  NotificationType.CONTENT_SUBMITTED,
  NotificationType.SUBSCRIPTION_REQUEST_SUBMITTED,
]);

const SUBSCRIPTION_SUBJECT: Partial<Record<NotificationType, string>> = {
  [NotificationType.SUBSCRIPTION_ACTIVE]: 'Your EGS membership is now active',
  [NotificationType.SUBSCRIPTION_EXPIRING]: 'Your EGS membership expires in 7 days',
  [NotificationType.SUBSCRIPTION_EXPIRED]: 'Your EGS membership has expired',
  [NotificationType.SUBSCRIPTION_CANCELED]: 'Your EGS membership has been canceled',
};

const SUBSCRIPTION_INTRO: Partial<Record<NotificationType, string>> = {
  [NotificationType.SUBSCRIPTION_ACTIVE]: 'Your membership is active and your benefits are ready to use.',
  [NotificationType.SUBSCRIPTION_EXPIRING]:
    'Your membership will end soon. Renew to keep your benefits without interruption.',
  [NotificationType.SUBSCRIPTION_EXPIRED]:
    'Your membership has ended. You can renew at any time to restore your benefits.',
  [NotificationType.SUBSCRIPTION_CANCELED]:
    'An administrator has canceled your membership. Reply to this email if you believe this was a mistake.',
};

const SUBSCRIPTION_CTA: Partial<Record<NotificationType, string>> = {
  [NotificationType.SUBSCRIPTION_ACTIVE]: 'View membership',
  [NotificationType.SUBSCRIPTION_EXPIRING]: 'Renew membership',
  [NotificationType.SUBSCRIPTION_EXPIRED]: 'Renew membership',
  [NotificationType.SUBSCRIPTION_CANCELED]: 'View membership',
};

const GREETING =
  "Thank you for being part of the European Gamelan Society. We're writing to keep you up to date with what's happening across the platform.";

const ADMIN_BODY = 'Sign in to the dashboard to approve or reject it.';
export const DETAIL_VALUE_MAX = 160;

// Detail request → baris `Label: value` (newline dipisah) untuk kolom `body`.
// Nilai kosong dibuang; HTML di-strip; satu baris per detail.
export function formatDetails(
  details: Array<{ label: string; value: string | null | undefined }> | undefined,
): string | null {
  const lines = (details ?? [])
    .map(({ label, value }) => ({ label, value: toExcerpt(value, DETAIL_VALUE_MAX) }))
    .filter((row): row is { label: string; value: string } => Boolean(row.value))
    .map((row) => `${row.label}: ${row.value}`);
  return lines.length > 0 ? lines.join('\n') : null;
}

function parseDetails(excerpt: string | null | undefined): Array<{ label: string; value: string }> {
  return (excerpt ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.indexOf(': ');
      return at > 0 ? { label: line.slice(0, at), value: line.slice(at + 2) } : { label: line, value: '' };
    });
}

// Token brand EGS (docs/modules/notification.md §8).
const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
const SANS = "'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const INK = '#2D1F1A';
const MUTED = '#555555';
const HAIRLINE = '#E0D5C5';
const ACCENT = '#8B2E3B';
const PAGE = '#F5F0E0';
const CARD = '#FAF7EE';

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

// Aset statis FE (mis. `logo.png`) dari base yang sama dengan `buildContentUrl`.
export function buildAssetUrl(baseUrl: string | undefined, path: string): string | null {
  if (!baseUrl || !safeHttpUrl(baseUrl)) return null;
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
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
  const fixed = SUBSCRIPTION_SUBJECT[input.type];
  if (fixed) return fixed;
  if (input.type === NotificationType.SUBSCRIPTION_REQUEST_SUBMITTED) {
    return `Subscription request from ${input.title} is waiting for your review`;
  }
  if (input.type === NotificationType.CONTENT_SUBMITTED) {
    return `New ${input.label} "${input.title}" is waiting for your review`;
  }
  return `New ${input.label} "${input.title}" is now live`;
}

// Pembuka untuk tipe admin: menandakan ada yang menunggu diproses.
function adminOpening(type: NotificationType, label: string): string {
  if (type === NotificationType.SUBSCRIPTION_REQUEST_SUBMITTED) {
    return 'A new subscription request is waiting for you to review.';
  }
  return `A new ${label} submission is waiting for you to review.`;
}

function sentence(type: NotificationType, label: string): string {
  if (type === NotificationType.SUBSCRIPTION_REQUEST_SUBMITTED || type === NotificationType.CONTENT_SUBMITTED) {
    return adminOpening(type, label);
  }
  return 'A new piece of content has just been published on the EGS platform.';
}

// `YYYY-MM-DD` UTC (dipakai baris detail tanggal email).
export function formatNotificationDate(date: Date): string {
  return date.toISOString().slice(0, 10);
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
  recipientName?: string | null;
  logoUrl?: string | null;
}): RenderedNotification {
  const type = input.type ?? NotificationType.CONTENT_PUBLISHED;
  // Sapaan sekali pakai untuk html + text; nama kosong/spasi → sapaan generik.
  const recipient = input.recipientName?.trim();
  const salutation = recipient ? `Hello ${escapeHtml(recipient)},` : 'Hello,';
  const label = ENTITY_LABEL[input.entityType ?? NotificationEntityType.POST];
  const title = input.title;
  const safeTitle = escapeHtml(title);
  const href = safeHttpUrl(input.url);
  const image = safeHttpUrl(input.imageUrl);
  const logo = safeHttpUrl(input.logoUrl);
  // Header mengarah ke root situs: `.../logo.png` → `.../`.
  const siteRoot = logo ? logo.replace(/[^/]*$/, '') : null;
  const isAdmin = ADMIN_TYPES.has(type);
  const subscriptionCta = SUBSCRIPTION_CTA[type];
  const cta =
    subscriptionCta ??
    (type === NotificationType.CONTENT_PUBLISHED
      ? 'Read more'
      : type === NotificationType.SUBSCRIPTION_REQUEST_SUBMITTED
        ? 'Process request'
        : 'Review submission');
  const intro = SUBSCRIPTION_INTRO[type] ?? (isAdmin ? ADMIN_BODY : sentence(type, label));
  const greeting = isAdmin ? sentence(type, label) : GREETING;
  // Tipe admin & lifecycle sama-sama merender blok detail dari `body`.
  const details = isAdmin || subscriptionCta ? parseDetails(input.excerpt) : [];

  const card = [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${CARD};border:1px solid ${HAIRLINE};border-radius:4px;border-collapse:separate;border-spacing:0;overflow:hidden;">`,
    `<tr><td style="padding:28px;">
      <p style="margin:0 0 10px;font-family:${SANS};font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;font-weight:500;color:${ACCENT};">${escapeHtml(label)}</p>
      <p style="margin:0;font-family:${SERIF};font-size:26px;line-height:34px;font-weight:600;color:${INK};">${safeTitle}</p>
    </td></tr>`,
    '</table>',
  ].join('');

  const detailBlock =
    details.length === 0
      ? ''
      : [
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${CARD};border:1px solid ${HAIRLINE};border-radius:4px;border-collapse:separate;border-spacing:0;overflow:hidden;">`,
          '<tr><td style="padding:4px 28px;">',
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">',
          ...details.map(
            ({ label: detailLabel, value }, index) => `<tr>
        <td style="padding:12px 12px 12px 0;${index === 0 ? '' : `border-top:1px solid ${HAIRLINE};`}width:140px;font-family:${SANS};font-size:11px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;font-weight:500;color:${MUTED};vertical-align:top;">${escapeHtml(detailLabel)}</td>
        <td style="padding:12px 0;${index === 0 ? '' : `border-top:1px solid ${HAIRLINE};`}font-family:${SANS};font-size:15px;line-height:22px;color:${INK};vertical-align:top;">${escapeHtml(value)}</td>
      </tr>`,
          ),
          '</table>',
          '</td></tr>',
          '</table>',
        ].join('');

  const html = [
    '<!doctype html>',
    '<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />',
    "<style>@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=DM+Sans:wght@400;500&display=swap');</style>",
    '</head>',
    `<body style="margin:0;padding:0;background:${PAGE};">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE};">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
          <tr><td align="center" style="padding:0 0 28px;">${
            logo
              ? `<a href="${escapeHtml(siteRoot!)}" style="text-decoration:none;"><img src="${escapeHtml(logo)}" alt="European Gamelan Society" width="160" height="83" style="display:block;width:160px;height:83px;border:0;outline:none;text-decoration:none;" /></a>`
              : `<span style="font-family:${SERIF};font-size:22px;line-height:28px;color:${INK};">European Gamelan Society</span>`
          }</td></tr>
          <tr><td style="padding:0 0 20px;font-family:${SANS};">
            <p style="margin:0;font-family:${SANS};font-size:18px;line-height:26px;color:${INK};">${salutation}</p>
            <p style="margin:8px 0 0;font-family:${SANS};font-size:16px;line-height:26px;color:${MUTED};">${escapeHtml(greeting)}</p>
            <p style="margin:8px 0 0;font-family:${SANS};font-size:16px;line-height:26px;color:${MUTED};">${escapeHtml(intro)}</p>
          </td></tr>`,
    image
      ? `<tr><td style="padding:0 0 20px;"><img src="${escapeHtml(image)}" alt="${safeTitle}" width="600" style="display:block;width:100%;max-width:600px;height:240px;object-fit:cover;border:0;border-radius:4px;outline:none;text-decoration:none;" /></td></tr>`
      : '',
    `<tr><td>${href ? `<a href="${escapeHtml(href)}" style="display:block;color:${INK};text-decoration:none;">${card}</a>` : card}</td></tr>`,
    detailBlock ? `<tr><td style="padding:16px 0 0;">${detailBlock}</td></tr>` : '',
    href
      ? `<tr><td style="padding:24px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="background:${ACCENT};border-radius:2px;">
              <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:13px;line-height:18px;letter-spacing:0.08em;text-transform:uppercase;font-weight:500;color:${PAGE};text-decoration:none;border-radius:2px;">${cta}</a>
            </td></tr>
          </table>
        </td></tr>`
      : '',
    `<tr><td style="padding:28px 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${INK};border-radius:4px;">
            <tr><td style="padding:24px 28px;font-family:${SANS};">
              <p style="margin:0;font-family:${SERIF};font-size:15px;line-height:22px;color:${PAGE};">European Gamelan Society</p>
              <p style="margin:6px 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${PAGE};">info@europeangamelansociety.com</p>
              <p style="margin:10px 0 0;font-family:${SANS};font-size:12px;line-height:18px;color:${HAIRLINE};">This email was sent automatically by EGS.</p>
            </td></tr>
          </table>
        </td></tr>
        </table>
      </td></tr>
    </table>`,
    '</body></html>',
  ].join('');

  return {
    subject: subject({ type, label, title }),
    text: [
      salutation,
      greeting,
      intro,
      title,
      ...details.map(({ label: detailLabel, value }) => `${detailLabel}: ${value}`),
      href ?? '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    html,
  };
}
