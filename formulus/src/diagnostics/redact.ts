import { ALLOWED_EXTRA_KEYS, AllowedLogExtras } from './types';

export const DEFAULT_MESSAGE_MAX = 500;
export const WEBVIEW_INFO_MESSAGE_MAX = 200;

const BEARER_RE = /bearer\s+[a-z0-9._\-+=/]+/gi;
const COOKIE_RE = /(?:cookie|set-cookie)\s*[:=]\s*[^;\s]+/gi;
const FILE_URI_RE = /file:\/\/[^\s"'`]+/gi;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const LATLON_RE =
  /\b-?(?:[1-8]?\d(?:\.\d+)?|90(?:\.0+)?),\s*-?(?:1[0-7]\d(?:\.\d+)?|180(?:\.0+)?|[1-9]?\d(?:\.\d+)?)\b/g;
const JSON_BLOB_RE = /\{[^{}]{40,}\}/g;

export function pickAllowedExtras(
  extras?: Record<string, unknown> | AllowedLogExtras | null,
): AllowedLogExtras | undefined {
  if (!extras || typeof extras !== 'object') {
    return undefined;
  }
  const out: AllowedLogExtras = {};
  for (const key of ALLOWED_EXTRA_KEYS) {
    if (!(key in extras)) {
      continue;
    }
    const value = (extras as Record<string, unknown>)[key];
    if (
      key === 'counts' &&
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {
      out.counts = value;
    } else if (key === 'success' && typeof value === 'boolean') {
      out.success = value;
    } else if (
      (key === 'phase' || key === 'formType' || key === 'screen') &&
      typeof value === 'string'
    ) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function redactText(
  input: unknown,
  maxLength: number = DEFAULT_MESSAGE_MAX,
): string {
  let text = stringifyUnknown(input);
  text = text.replace(BEARER_RE, 'Bearer [redacted]');
  text = text.replace(COOKIE_RE, 'cookie=[redacted]');
  text = text.replace(FILE_URI_RE, 'file://[redacted]');
  text = text.replace(EMAIL_RE, '[email]');
  text = text.replace(LATLON_RE, '[latlon]');
  text = text.replace(JSON_BLOB_RE, '[json]');
  if (text.length > maxLength) {
    return `${text.slice(0, maxLength)}…`;
  }
  return text;
}

export function joinLogArgs(args: unknown[]): string {
  return args
    .map(arg => {
      if (arg == null) {
        return String(arg);
      }
      if (typeof arg === 'string') {
        return looksLikeJsonObject(arg) ? '[json]' : arg;
      }
      if (typeof arg === 'object') {
        return '[json]';
      }
      return String(arg);
    })
    .filter(part => part.length > 0)
    .join(' ');
}

function looksLikeJsonObject(value: string): boolean {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}') && trimmed.length > 40) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']') && trimmed.length > 40)
  );
}

function stringifyUnknown(input: unknown): string {
  if (input == null) {
    return '';
  }
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof Error) {
    return input.message || input.name;
  }
  if (typeof input === 'object') {
    try {
      return JSON.stringify(input);
    } catch {
      return String(input);
    }
  }
  return String(input);
}
