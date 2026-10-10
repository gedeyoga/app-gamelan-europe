// Resolusi link Google Maps → koordinat `lat`/`lng` + `embedUrl` siap-embed.
// Keyless (tanpa API key): hanya parse URL + follow shortlink redirect.
// ponytail: tanpa geocoding balik (nama→koordinat); tambah bila alamat teks perlu di-resolve.

const SHORTLINK_APEX = 'maps.app.goo.gl';
const SHORTLINK_GOO = 'goo.gl';
// Query params maps-ish pada path root (mis. `?q=...`).
const MAPS_QUERY_RE = /(?:^|[?&])(?:q|query|ll|center|destination|daddr|saddr|dir|place|output)=/i;
const MAX_REDIRECT_HOPS = 5;

// Host Google Maps: `google.<tld>` / `maps.google.<tld>` / `www.google.<tld>`.
// Label eksplisit (bukan regex longgar) → tolak `google.attacker.com`, `google.com.evil.com`.
function isAllowedGoogleHost(hostname: string): boolean {
  const labels = hostname.toLowerCase().replace(/\.$/, '').split('.');
  if (labels[0] === 'www' || labels[0] === 'maps') labels.shift();
  if (labels[0] !== 'google') return false;
  if (labels.length !== 2 && labels.length !== 3) return false;
  return labels.slice(1).every((label) => /^[a-z]{2,3}$/i.test(label));
}

// Shortlink: `maps.app.goo.gl` selalu; `goo.gl` hanya path `/maps` (goo.gl umum → hindari SSRF).
function isAllowedShortlink(hostname: string, pathname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === SHORTLINK_APEX) return true;
  if (host === SHORTLINK_GOO) return pathname.startsWith('/maps');
  return false;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function inRange(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function toPair(lat: number, lng: number): { lat: number; lng: number } | null {
  return inRange(lat, lng) ? { lat, lng } : null;
}

// `lat,lng` | `loc:lat,lng` | `lat lng` → pasangan tervalidasi.
function parsePair(value: string): { lat: number; lng: number } | null {
  const cleaned = value.replace(/^loc:/i, '').trim();
  const m = /^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/.exec(cleaned);
  return m ? toPair(Number(m[1]), Number(m[2])) : null;
}

// Host Google Maps valid (long URL atau shortlink host).
export function isGoogleMapsUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (isAllowedShortlink(url.hostname, url.pathname)) return true;
  if (!isAllowedGoogleHost(url.hostname)) return false;
  return url.pathname.startsWith('/maps') || MAPS_QUERY_RE.test(url.search);
}

// Prioritas: pin `!3d!4d` → viewport `@lat,lng` → query param. Null bila tak ada/out-of-range.
export function parseLatLng(url: string): { lat: number; lng: number } | null {
  const decoded = safeDecode(url);

  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(decoded);
  if (pin) {
    const pair = toPair(Number(pin[1]), Number(pin[2]));
    if (pair) return pair;
  }

  const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(decoded);
  if (at) {
    const pair = toPair(Number(at[1]), Number(at[2]));
    if (pair) return pair;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  for (const key of ['q', 'query', 'll', 'center', 'destination', 'daddr']) {
    const value = parsed.searchParams.get(key);
    if (!value) continue;
    const pair = parsePair(value);
    if (pair) return pair;
  }
  return null;
}

export function buildEmbedUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}&z=15&hl=en&output=embed`;
}

// Parse langsung (tanpa jaringan) bila koordinat sudah ada; selain itu follow redirect shortlink
// secara manual (maks 5 hop, tiap hop divalidasi host). Selalu return null saat gagal — tak pernah throw.
export async function resolveGoogleMapsLink(
  raw: string,
): Promise<{ lat: number; lng: number; embedUrl: string } | null> {
  // Gate host lebih dulu → URL non-Google tak pernah diparse/difetch.
  if (!isGoogleMapsUrl(raw)) return null;
  const direct = parseLatLng(raw);
  if (direct) return { ...direct, embedUrl: buildEmbedUrl(direct.lat, direct.lng) };

  let current = raw;
  try {
    for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
      const res = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return null;
        const next = new URL(location, current).toString();
        // Tiap hop harus tetap host Google Maps → cegah open-redirect/SSRF.
        if (!isGoogleMapsUrl(next)) return null;
        current = next;
        continue;
      }
      if (!res.ok) return null;
      // Re-validasi host final sebelum diparse.
      if (!isGoogleMapsUrl(res.url)) return null;
      const resolved = parseLatLng(res.url);
      return resolved ? { ...resolved, embedUrl: buildEmbedUrl(resolved.lat, resolved.lng) } : null;
    }
    return null;
  } catch {
    return null;
  }
}
