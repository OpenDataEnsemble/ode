/**
 * Derive the Synkronus origin URL that Formulus should connect to.
 * Matches CLI `api.url` semantics (origin, not portal `/api` proxy path).
 */
export function getFormulusServerUrl(): string {
  const viteUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

  if (viteUrl && /^https?:\/\//i.test(viteUrl)) {
    try {
      return new URL(viteUrl).origin;
    } catch {
      return viteUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    }
  }

  const { protocol, hostname, port } = window.location;

  // Vite portal proxies /api to Synkronus; Formulus needs the API origin.
  if (port === '5174' || port === '5173') {
    return `${protocol}//${hostname}:8080`;
  }

  // Production: portal is embedded in Synkronus on the same origin.
  return window.location.origin;
}
