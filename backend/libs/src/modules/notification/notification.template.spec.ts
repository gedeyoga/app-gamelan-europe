import { NotificationEntityType, NotificationType } from '@prisma/client';
import {
  buildAssetUrl,
  buildContentUrl,
  buildLinkPath,
  renderNotification,
  toExcerpt,
} from './notification.template';

describe('notification.template', () => {
  describe('toExcerpt', () => {
    it('membuang tag HTML dan merapikan whitespace', () => {
      expect(toExcerpt('<p>Halo <strong>dunia</strong></p>\n<p>baris 2</p>')).toBe('Halo dunia baris 2');
    });

    it('null/kosong → null', () => {
      expect(toExcerpt(null)).toBeNull();
      expect(toExcerpt('<p></p>')).toBeNull();
    });

    it('memotong ≤300 char', () => {
      const excerpt = toExcerpt('a'.repeat(400));
      expect(excerpt).not.toBeNull();
      expect(excerpt!.length).toBe(300);
      expect(excerpt!.endsWith('…')).toBe(true);
    });
  });

  describe('buildLinkPath', () => {
    it('memakai slug per domain', () => {
      expect(buildLinkPath(NotificationEntityType.POST, 'hello-world')).toBe('/stories/hello-world');
      expect(buildLinkPath(NotificationEntityType.EVENT, 'hello-world')).toBe('/events/hello-world');
      expect(buildLinkPath(NotificationEntityType.ARCHIVE, 'hello-world')).toBe('/archives/hello-world');
      expect(buildLinkPath(NotificationEntityType.NETWORK, 'hello-world')).toBe('/networks/hello-world');
      expect(buildLinkPath(NotificationEntityType.SUBSCRIPTION_REQUEST, 'hello-world')).toBe(
        '/subscription-requests/hello-world',
      );
      expect(buildLinkPath(NotificationEntityType.SUBSCRIPTION, 'b1')).toBe('/my-billings/b1');
    });

    it('slug null → null (tanpa fallback id)', () => {
      expect(buildLinkPath(NotificationEntityType.POST, null)).toBeNull();
    });

    it('encodeURI per segmen slug', () => {
      expect(buildLinkPath(NotificationEntityType.POST, 'a b/c')).toBe('/stories/a%20b%2Fc');
    });
  });

  describe('buildContentUrl', () => {
    it('menggabung APP_WEB_URL tanpa double slash', () => {
      expect(buildContentUrl('https://app.example.com/', '/stories/x')).toBe('https://app.example.com/stories/x');
    });

    it('tanpa base/link → null', () => {
      expect(buildContentUrl(undefined, '/stories/x')).toBeNull();
      expect(buildContentUrl('https://app.example.com', null)).toBeNull();
    });
  });

  describe('buildAssetUrl', () => {
    it('menggabung base tanpa double slash', () => {
      expect(buildAssetUrl('https://app.example.com', 'logo.png')).toBe('https://app.example.com/logo.png');
      expect(buildAssetUrl('https://app.example.com/', 'logo.png')).toBe('https://app.example.com/logo.png');
      expect(buildAssetUrl('https://app.example.com///', '/logo.png')).toBe('https://app.example.com/logo.png');
    });

    it('tanpa base → null', () => {
      expect(buildAssetUrl(undefined, 'logo.png')).toBeNull();
      expect(buildAssetUrl('', 'logo.png')).toBeNull();
    });

    it('base non-http(s) → null', () => {
      expect(buildAssetUrl('javascript:alert(1)', 'logo.png')).toBeNull();
      expect(buildAssetUrl('/relative', 'logo.png')).toBeNull();
    });
  });

  describe('renderNotification', () => {
    const entityType = NotificationEntityType.POST;

    it('escape title dan merakit link absolut', () => {
      const result = renderNotification({
        type: NotificationType.CONTENT_PUBLISHED,
        entityType,
        title: '<b>Judul</b>',
        excerpt: '<script>alert(1)</script>',
        url: 'https://app.example.com/stories/x?q=1&r=2',
      });
      expect(result.subject).toBe('New Story "<b>Judul</b>" is now live');
      expect(result.html).toContain('&lt;b&gt;Judul&lt;/b&gt;');
      expect(result.html).not.toContain('<script>');
      expect(result.html).toContain('href="https://app.example.com/stories/x?q=1&amp;r=2"');
      expect(result.text).toContain('https://app.example.com/stories/x?q=1&r=2');
    });

    it('greeting + kalimat + judul + URL di plain text', () => {
      const result = renderNotification({
        type: NotificationType.CONTENT_PUBLISHED,
        entityType,
        title: 'Judul',
        url: 'https://app.example.com/stories/x',
      });
      expect(result.text).toBe(
        'Hello,\n\nThank you for being part of the European Gamelan Society. We\'re writing to keep you up to date with what\'s happening across the platform.\n\nA new piece of content has just been published on the EGS platform.\n\nJudul\n\nhttps://app.example.com/stories/x',
      );
    });

    it('recipientName → sapaan personal di html + text; kosong → Hello,', () => {
      const named = renderNotification({ entityType, title: 'Judul', recipientName: 'Yoga' });
      expect(named.html).toContain('Hello Yoga,');
      expect(named.text.startsWith('Hello Yoga,')).toBe(true);

      for (const recipientName of [undefined, null, '', '   ']) {
        const fallback = renderNotification({ entityType, title: 'Judul', recipientName });
        expect(fallback.html).toContain('>Hello,<');
        expect(fallback.text.startsWith('Hello,')).toBe(true);
      }
    });

    it('tanpa URL: kartu tetap tampil, tanpa link/CTA', () => {
      const result = renderNotification({ entityType, title: 'Judul', url: null });
      expect(result.text).toBe(
        'Hello,\n\nThank you for being part of the European Gamelan Society. We\'re writing to keep you up to date with what\'s happening across the platform.\n\nA new piece of content has just been published on the EGS platform.\n\nJudul',
      );
      expect(result.html).not.toContain('Read more');
      expect(result.html).not.toContain('href=');
    });

    it('thumbnail http(s) → img 16:9; tanpa thumbnail → tanpa img', () => {
      const withImage = renderNotification({
        entityType,
        title: 'Judul',
        url: 'https://app.example.com/stories/x',
        imageUrl: 'https://cdn.example.com/a.jpg',
      });
      expect(withImage.html).toContain('<img src="https://cdn.example.com/a.jpg"');
      expect(withImage.html).toContain('height:240px');
      expect(withImage.html).toContain('object-fit:cover');

      const withoutImage = renderNotification({ entityType, title: 'Judul' });
      expect(withoutImage.html).not.toContain('<img');
    });

    it('imageUrl non-http(s) → diabaikan', () => {
      const result = renderNotification({ entityType, title: 'Judul', imageUrl: 'javascript:alert(1)' });
      expect(result.html).not.toContain('<img');
    });

    it('URL javascript: → tanpa link', () => {
      const result = renderNotification({ entityType, title: 'Judul', url: 'javascript:alert(1)' });
      expect(result.html).not.toContain('href=');
    });

    it('subject memuat tipe konten + judul', () => {
      expect(
        renderNotification({ type: NotificationType.CONTENT_PUBLISHED, entityType, title: 'X' }).subject,
      ).toBe('New Story "X" is now live');
      expect(
        renderNotification({ type: NotificationType.CONTENT_SUBMITTED, entityType, title: 'X' }).subject,
      ).toBe('New Story "X" is waiting for your review');
      expect(
        renderNotification({
          type: NotificationType.CONTENT_SUBMITTED,
          entityType: NotificationEntityType.EVENT,
          title: 'X',
        }).subject,
      ).toBe('New Event "X" is waiting for your review');
      expect(
        renderNotification({
          type: NotificationType.CONTENT_SUBMITTED,
          entityType: NotificationEntityType.ARCHIVE,
          title: 'X',
        }).subject,
      ).toBe('New Archive "X" is waiting for your review');
      expect(
        renderNotification({
          type: NotificationType.CONTENT_SUBMITTED,
          entityType: NotificationEntityType.NETWORK,
          title: 'X',
        }).subject,
      ).toBe('New Network "X" is waiting for your review');
      expect(
        renderNotification({
          type: NotificationType.SUBSCRIPTION_REQUEST_SUBMITTED,
          entityType: NotificationEntityType.SUBSCRIPTION_REQUEST,
          title: 'Budi - Basic',
        }).subject,
      ).toBe('Subscription request from Budi - Basic is waiting for your review');
    });

    it('subject tanpa kolon dan tanpa dash', () => {
      const cases = [
        { type: NotificationType.CONTENT_PUBLISHED, entityType },
        { type: NotificationType.CONTENT_SUBMITTED, entityType },
        { type: NotificationType.CONTENT_SUBMITTED, entityType: NotificationEntityType.EVENT },
        { type: NotificationType.CONTENT_SUBMITTED, entityType: NotificationEntityType.ARCHIVE },
        { type: NotificationType.CONTENT_SUBMITTED, entityType: NotificationEntityType.NETWORK },
        {
          type: NotificationType.SUBSCRIPTION_REQUEST_SUBMITTED,
          entityType: NotificationEntityType.SUBSCRIPTION_REQUEST,
        },
      ];
      for (const c of cases) {
        expect(renderNotification({ ...c, title: 'Judul Biasa' }).subject).toMatch(/^[^:–—-]+$/);
      }
    });

    it('CTA per tipe', () => {
      const published = renderNotification({
        type: NotificationType.CONTENT_PUBLISHED,
        entityType,
        title: 'X',
        url: 'https://app.example.com/stories/x',
      });
      expect(published.html).toContain('Read more');
      const submitted = renderNotification({
        type: NotificationType.CONTENT_SUBMITTED,
        entityType,
        title: 'X',
        url: 'https://app.example.com/dashboard',
      });
      expect(submitted.html).toContain('Review submission');
      expect(submitted.html).toContain('A new Story submission is waiting for you to review.');
      expect(submitted.html).toContain('Sign in to the dashboard to approve or reject it.');
      expect(submitted.html).not.toContain('Thank you for being part');
      const subscription = renderNotification({
        type: NotificationType.SUBSCRIPTION_REQUEST_SUBMITTED,
        entityType: NotificationEntityType.SUBSCRIPTION_REQUEST,
        title: 'Budi - Basic',
        url: 'https://app.example.com/subscription-requests/s1',
      });
      expect(subscription.html).toContain('Process request');
      expect(subscription.html).toContain('A new subscription request is waiting for you to review.');
    });

    it('detail request dirender sebagai baris label/value di html + text', () => {
      const result = renderNotification({
        type: NotificationType.CONTENT_SUBMITTED,
        entityType,
        title: 'Judul',
        excerpt: 'Submitted by: <b>Budi</b>\nEmail: a@b.c',
        url: 'https://app.example.com/dashboard',
      });
      expect(result.html).toContain('Submitted by');
      expect(result.html).toContain('&lt;b&gt;Budi&lt;/b&gt;');
      expect(result.html).toContain('Email');
      expect(result.html).toContain('a@b.c');
      expect(result.text).toContain('Submitted by: <b>Budi</b>\n\nEmail: a@b.c');
    });

    it('detail tidak dirender untuk CONTENT_PUBLISHED', () => {
      const result = renderNotification({
        type: NotificationType.CONTENT_PUBLISHED,
        entityType,
        title: 'Judul',
        excerpt: 'Excerpt: biasa',
      });
      expect(result.html).not.toContain('Excerpt');
      expect(result.text).not.toContain('Excerpt');
    });

    it('lifecycle subscription: member-facing, subject/intro/CTA per tipe', () => {
      const cases = [
        {
          type: NotificationType.SUBSCRIPTION_ACTIVE,
          subject: 'Your EGS membership is now active',
          intro: 'Your membership is active and your benefits are ready to use.',
          cta: 'View membership',
          expiryLabel: 'Active until',
        },
        {
          type: NotificationType.SUBSCRIPTION_EXPIRING,
          subject: 'Your EGS membership expires in 7 days',
          intro: 'Your membership will end soon. Renew to keep your benefits without interruption.',
          cta: 'Renew membership',
          expiryLabel: 'Expires on',
        },
        {
          type: NotificationType.SUBSCRIPTION_EXPIRED,
          subject: 'Your EGS membership has expired',
          intro: 'Your membership has ended. You can renew at any time to restore your benefits.',
          cta: 'Renew membership',
          expiryLabel: 'Expires on',
        },
        {
          type: NotificationType.SUBSCRIPTION_CANCELED,
          subject: 'Your EGS membership has been canceled',
          intro:
            'An administrator has canceled your membership. Reply to this email if you believe this was a mistake.',
          cta: 'View membership',
          expiryLabel: 'Canceled on',
        },
      ];
      for (const c of cases) {
        const result = renderNotification({
          type: c.type,
          entityType: NotificationEntityType.SUBSCRIPTION,
          title: 'Gold',
          excerpt: `Package: Gold\n${c.expiryLabel}: 2026-12-31`,
          url: 'https://app.example.com/my-billings',
        });
        expect(result.subject).toBe(c.subject);
        expect(result.html).toContain(c.intro);
        expect(result.html).toContain(c.cta);
        // Member-facing: tidak ada dekorasi admin.
        expect(result.html).not.toContain('Sign in to the dashboard');
        expect(result.html).not.toContain('waiting for you to review');
        expect(result.html).toContain('Membership');
        expect(result.html).toContain('Package');
        expect(result.text).toContain(`Package: Gold\n\n${c.expiryLabel}: 2026-12-31`);
      }
    });

    it('lifecycle subscription: sapaan personal + detail dari body', () => {
      const result = renderNotification({
        type: NotificationType.SUBSCRIPTION_EXPIRING,
        entityType: NotificationEntityType.SUBSCRIPTION,
        title: 'Gold',
        excerpt: 'Package: Gold\nExpires on: 2026-12-31\nDays left: 7',
        recipientName: 'Budi Santoso',
        url: 'https://app.example.com/my-billings',
      });
      expect(result.html).toContain('Hello Budi Santoso,');
      expect(result.text).toContain('Hello Budi Santoso,');
      expect(result.text).toContain('Days left: 7');
      expect(result.text).toContain('https://app.example.com/my-billings');
    });

    it('SUBSCRIPTION_CANCELED: member-facing, CTA bukan CTA admin', () => {
      const result = renderNotification({
        type: NotificationType.SUBSCRIPTION_CANCELED,
        entityType: NotificationEntityType.SUBSCRIPTION,
        title: 'Gold',
        excerpt: 'Package: Gold\nCanceled on: 2026-10-24',
        recipientName: 'Budi Santoso',
        url: 'https://app.example.com/my-billings',
      });
      expect(result.subject).toBe('Your EGS membership has been canceled');
      expect(result.subject).not.toContain(':');
      expect(result.subject).not.toMatch(/[–—-]/);
      expect(result.html).toContain('Hello Budi Santoso,');
      expect(result.html).toContain('View membership');
      expect(result.html).not.toContain('Process request');
      expect(result.html).not.toContain('Review submission');
      expect(result.html).not.toContain('Sign in to the dashboard');
      expect(result.html).toContain('Canceled on');
      expect(result.text).toContain('Package: Gold\n\nCanceled on: 2026-10-24');
      expect(result.text).toContain('https://app.example.com/my-billings');
    });

    it('logoUrl → img wordmark di header, tautan ke root situs', () => {
      const result = renderNotification({
        entityType,
        title: 'Judul',
        logoUrl: 'https://app.example.com/logo.png',
      });
      expect(result.html).toContain('src="https://app.example.com/logo.png"');
      expect(result.html).toContain('alt="European Gamelan Society"');
      expect(result.html).toContain('width="160"');
      expect(result.html).toContain('height="83"');
      expect(result.html).toContain('href="https://app.example.com/"');
    });

    it('logoUrl null → wordmark teks, tanpa <img>', () => {
      for (const logoUrl of [undefined, null]) {
        const result = renderNotification({ entityType, title: 'Judul', logoUrl });
        expect(result.html).not.toContain('<img');
        expect(result.html).not.toContain('logo.png');
        expect(result.html).toContain('European Gamelan Society');
      }
    });

    it('logoUrl non-http(s) → diabaikan', () => {
      const result = renderNotification({ entityType, title: 'Judul', logoUrl: 'javascript:alert(1)' });
      expect(result.html).not.toContain('<img');
    });

    it('memakai token brand EGS (terracotta, ivory, charcoal)', () => {
      const result = renderNotification({
        entityType,
        title: 'Judul',
        url: 'https://app.example.com/stories/x',
      });
      expect(result.html).toContain('#8B2E3B');
      expect(result.html).toContain('#F5F0E0');
      expect(result.html).toContain('#2D1F1A');
      expect(result.html).toContain('#FAF7EE');
      expect(result.html).toContain('#E0D5C5');
      expect(result.html).toContain('Cormorant Garamond');
      expect(result.html).toContain('DM Sans');
      expect(result.html).not.toContain('#1f6146');
      expect(result.html).not.toContain('#f4f5f3');
    });
  });
});
