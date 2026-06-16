/** Extract a user-facing message from Tauri invoke failures (often plain strings). */
export function messageFromUnknown(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message.trim()) {
    return e.message;
  }
  if (typeof e === 'string' && e.trim()) {
    return e;
  }
  if (e == null) {
    return fallback;
  }
  const s = String(e);
  return s && s !== '[object Object]' ? s : fallback;
}
