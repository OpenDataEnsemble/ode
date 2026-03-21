/** Internal to formplayer: identifies one in-progress "new" observation draft among several for the same formType. */
export function newDraftSessionKey(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
