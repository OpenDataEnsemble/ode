/** Push confirmation body shown before syncing dirty observations. */
export function pushConfirmMessage(
  observationCount: number,
  profileLabel: string,
): string {
  const label = profileLabel.trim() || 'this profile';
  const noun = observationCount === 1 ? 'observation' : 'observations';
  return `Push ${observationCount} ${noun} to ${label}?`;
}
