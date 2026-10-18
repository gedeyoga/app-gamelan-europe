import { NotificationEntityType, NotificationType } from '@prisma/client';
import {
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
      expect(result.subject).toBe('New Story: <b>Judul</b>');
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
      ).toBe('New Story: X');
      expect(
        renderNotification({ type: NotificationType.CONTENT_SUBMITTED, entityType, title: 'X' }).subject,
      ).toBe('New Story submission: X');
      expect(
        renderNotification({
          type: NotificationType.CONTENT_SUBMITTED,
          entityType: NotificationEntityType.EVENT,
          title: 'X',
        }).subject,
      ).toBe('New Event submission: X');
      expect(
        renderNotification({
          type: NotificationType.CONTENT_SUBMITTED,
          entityType: NotificationEntityType.ARCHIVE,
          title: 'X',
        }).subject,
      ).toBe('New Archive submission: X');
      expect(
        renderNotification({
          type: NotificationType.CONTENT_SUBMITTED,
          entityType: NotificationEntityType.NETWORK,
          title: 'X',
        }).subject,
      ).toBe('New Network submission: X');
      expect(
        renderNotification({
          type: NotificationType.SUBSCRIPTION_REQUEST_SUBMITTED,
          entityType: NotificationEntityType.SUBSCRIPTION_REQUEST,
          title: 'Budi - Basic',
        }).subject,
      ).toBe('New subscription request: Budi - Basic');
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
      expect(submitted.html).toContain('A new Story submission has arrived and is waiting for review.');
    });
  });
});
