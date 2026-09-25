/** RN's DOM URL typedef is incomplete; runtime URL has these fields. */
type ParsedHttpUrl = {
  protocol: string;
  hostname: string;
  host: string;
  pathname: string;
  search: string;
  hash: string;
};

export type NormalizeServerUrlResult =
  | { ok: true; href: string; isHttp: boolean }
  | { ok: false; message: string };

/**
 * Trim, infer https when no scheme (or protocol-relative //), lowercase host and path,
 * strip a trailing slash on the path, and validate http(s) with a non-empty host.
 */
export function normalizeServerUrl(raw: string): NormalizeServerUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: 'Please enter a valid server URL' };
  }

  let scheme: 'http' | 'https';
  let remainder: string;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('https://')) {
    scheme = 'https';
    remainder = trimmed.slice('https://'.length);
  } else if (lower.startsWith('http://')) {
    scheme = 'http';
    remainder = trimmed.slice('http://'.length);
  } else if (lower.startsWith('//')) {
    scheme = 'https';
    remainder = trimmed.slice(2);
  } else {
    scheme = 'https';
    remainder = trimmed;
  }

  if (!remainder.trim()) {
    return { ok: false, message: 'Please enter a valid server URL' };
  }

  const candidate = `${scheme}://${remainder}`;

  let parsed: ParsedHttpUrl;
  try {
    parsed = new URL(candidate) as unknown as ParsedHttpUrl;
  } catch {
    return { ok: false, message: 'Please enter a valid URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, message: 'URL scheme must be http:// or https://' };
  }

  if (!parsed.hostname) {
    return { ok: false, message: 'Please enter a valid server URL' };
  }

  parsed.hostname = parsed.hostname.toLowerCase();
  let path = parsed.pathname;
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  if (path && path !== '/') {
    path = path.toLowerCase();
  } else {
    path = '';
  }

  const href = `${parsed.protocol}//${parsed.host}${path}${parsed.search}${parsed.hash}`;
  return { ok: true, href, isHttp: parsed.protocol === 'http:' };
}
