import { buildEmbedUrl, isGoogleMapsUrl, parseLatLng, resolveGoogleMapsLink } from './google-maps.util';

describe('google-maps.util', () => {
  describe('parseLatLng', () => {
    it('extracts viewport centre @lat,lng', () => {
      expect(parseLatLng('https://www.google.com/maps/@-8.65,115.21,15z')).toEqual({ lat: -8.65, lng: 115.21 });
    });

    it('prefers place pin !3d!4d over viewport', () => {
      const url = 'https://www.google.com/maps/place/X/@1.1,2.2,17z/data=!3m1!4b1!4m5!3d-6.2!4d106.8';
      expect(parseLatLng(url)).toEqual({ lat: -6.2, lng: 106.8 });
    });

    it('extracts ?q=lat,lng', () => {
      expect(parseLatLng('https://maps.google.com/?q=-8.5,115.2')).toEqual({ lat: -8.5, lng: 115.2 });
    });

    it('extracts loc:lat,lng form', () => {
      expect(parseLatLng('https://maps.google.com/?q=loc:48.85,2.35')).toEqual({ lat: 48.85, lng: 2.35 });
    });

    it('rejects out-of-range coords → null', () => {
      expect(parseLatLng('https://www.google.com/maps/@999,999,15z')).toBeNull();
    });

    it('non-Google URL without coords → null', () => {
      expect(parseLatLng('https://example.com/foo?x=1')).toBeNull();
    });
  });

  describe('isGoogleMapsUrl', () => {
    it('accepts google host + maps path', () => {
      expect(isGoogleMapsUrl('https://www.google.com/maps/place/X')).toBe(true);
    });

    it('accepts shortlink host', () => {
      expect(isGoogleMapsUrl('https://maps.app.goo.gl/abc123')).toBe(true);
    });

    it('rejects arbitrary URL', () => {
      expect(isGoogleMapsUrl('https://example.com/maps')).toBe(false);
    });

    it('rejects google.attacker.com', () => {
      expect(isGoogleMapsUrl('https://google.attacker.com/maps/@1,2,15z')).toBe(false);
    });

    it('rejects google.com.evil.com', () => {
      expect(isGoogleMapsUrl('https://google.com.evil.com/maps?q=1,2')).toBe(false);
    });

    it('accepts google.co.uk / google.com.br', () => {
      expect(isGoogleMapsUrl('https://www.google.co.uk/maps/place/X')).toBe(true);
      expect(isGoogleMapsUrl('https://maps.google.com.br/maps/place/X')).toBe(true);
    });

    it('accepts goo.gl only under /maps', () => {
      expect(isGoogleMapsUrl('https://goo.gl/maps/abc')).toBe(true);
      expect(isGoogleMapsUrl('https://goo.gl/other')).toBe(false);
    });
  });

  describe('buildEmbedUrl', () => {
    it('builds keyless embed URL', () => {
      expect(buildEmbedUrl(1.5, 2.5)).toBe('https://www.google.com/maps?q=1.5,2.5&z=15&hl=en&output=embed');
    });
  });

  describe('resolveGoogleMapsLink', () => {
    const originalFetch = global.fetch;
    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('uses direct coords without network', async () => {
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy as unknown as typeof fetch;
      const out = await resolveGoogleMapsLink('https://www.google.com/maps/@-8.65,115.21,15z');
      expect(out).toEqual({ lat: -8.65, lng: 115.21, embedUrl: buildEmbedUrl(-8.65, 115.21) });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('follows shortlink redirect and parses final URL', async () => {
      const fetchSpy = jest
        .fn()
        .mockResolvedValue({ ok: true, url: 'https://www.google.com/maps/@1.5,2.5,15z' });
      global.fetch = fetchSpy as unknown as typeof fetch;
      const out = await resolveGoogleMapsLink('https://maps.app.goo.gl/abc');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://maps.app.goo.gl/abc',
        expect.objectContaining({ redirect: 'manual' }),
      );
      expect(out).toEqual({ lat: 1.5, lng: 2.5, embedUrl: buildEmbedUrl(1.5, 2.5) });
    });

    it('honours an HTTP redirect to a valid Google Maps URL', async () => {
      const fetchSpy = jest
        .fn()
        .mockResolvedValueOnce({
          status: 302,
          ok: false,
          headers: { get: () => 'https://www.google.com/maps/@3.5,4.5,15z' },
        })
        .mockResolvedValueOnce({ ok: true, url: 'https://www.google.com/maps/@3.5,4.5,15z' });
      global.fetch = fetchSpy as unknown as typeof fetch;
      const out = await resolveGoogleMapsLink('https://maps.app.goo.gl/abc');
      expect(out).toEqual({ lat: 3.5, lng: 4.5, embedUrl: buildEmbedUrl(3.5, 4.5) });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('rejects an HTTP redirect to a non-Google host', async () => {
      const fetchSpy = jest.fn().mockResolvedValueOnce({
        status: 302,
        ok: false,
        headers: { get: () => 'https://evil.com/maps/@1,2,15z' },
      });
      global.fetch = fetchSpy as unknown as typeof fetch;
      expect(await resolveGoogleMapsLink('https://maps.app.goo.gl/abc')).toBeNull();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('rejects google.attacker.com without network', async () => {
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy as unknown as typeof fetch;
      expect(await resolveGoogleMapsLink('https://google.attacker.com/maps/@1,2,15z')).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects google.com.evil.com without network', async () => {
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy as unknown as typeof fetch;
      expect(await resolveGoogleMapsLink('https://google.com.evil.com/maps?q=1,2')).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('gates host before parse → example.com coords rejected', async () => {
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy as unknown as typeof fetch;
      expect(await resolveGoogleMapsLink('https://example.com/?q=1,2')).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns null when fetch throws', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;
      expect(await resolveGoogleMapsLink('https://maps.app.goo.gl/abc')).toBeNull();
    });
  });
});
