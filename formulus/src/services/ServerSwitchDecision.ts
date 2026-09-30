/**
 * Helpers for deciding whether a user-entered server URL represents a real
 * server change or a first-time setup. Bound profiles require a new profile;
 * changing a URL must never erase local data.
 *
 * Extracted from `SettingsScreen.handleServerSwitchIfNeeded` so the regression
 * "dialog silently skipped when hydration hasn't finished" can be unit-tested
 * without rendering the full screen.
 */

import { normalizeServerUrl } from './normalizeServerUrl';

/**
 * Resolve the authoritative "previous server URL" for the switch decision.
 *
 * Prefers the profile registry (via `serverConfigService`) over stale
 * component state. The registry enforces the URL binding on every write.
 */
export async function resolvePreviousServerUrl(
  stateFallback: string,
  getPersisted: () => Promise<string | null>,
): Promise<string> {
  try {
    const persisted = await getPersisted();
    if (persisted != null && persisted.trim() !== '') {
      return persisted.trim();
    }
  } catch (err) {
    console.warn(
      'resolvePreviousServerUrl: failed to read persisted server URL',
      err,
    );
  }
  return stateFallback.trim();
}

export type ServerChangeClassification =
  | { kind: 'invalid'; message: string }
  | { kind: 'first-time'; normalizedUrl: string }
  | { kind: 'same'; normalizedUrl: string }
  | { kind: 'switch'; normalizedUrl: string; previousUrl: string };

/**
 * Decide how to handle a user-entered server URL given the (authoritative)
 * previous URL.
 *
 * - `invalid`     — URL failed normalization; show the message to the user.
 * - `first-time`  — no previous URL persisted; save silently, no wipe.
 * - `same`        — same server as before; nothing to warn about.
 * - `switch`      — different server; a bound profile requires a new profile.
 */
export function classifyServerChange(
  enteredUrl: string,
  previousUrl: string,
): ServerChangeClassification {
  const norm = normalizeServerUrl(enteredUrl);
  if (!norm.ok) {
    return { kind: 'invalid', message: norm.message };
  }
  const normalizedUrl = norm.href;

  const trimmedPrev = previousUrl.trim();
  if (!trimmedPrev) {
    return { kind: 'first-time', normalizedUrl };
  }

  const prevNorm = normalizeServerUrl(trimmedPrev);
  const comparable = prevNorm.ok ? prevNorm.href : trimmedPrev.toLowerCase();

  if (normalizedUrl === comparable) {
    return { kind: 'same', normalizedUrl };
  }

  return { kind: 'switch', normalizedUrl, previousUrl: comparable };
}
