/** Production push confirmation body (no server URL). */
export function productionPushConfirmDetail(dirtyCount: number): string {
  return `Push ${dirtyCount} pending observation(s) to production?`;
}
