/** Push confirmation body shown before syncing dirty observations. */
export function pushConfirmMessage(
  observationCount: number,
  profileLabel: string,
): string {
  const label = profileLabel.trim() || 'this profile';
  const noun = observationCount === 1 ? 'observation' : 'observations';
  return `Push ${observationCount} ${noun} to ${label}?`;
}

export function isRepositoryResetSyncError(
  errorCode?: string | null,
  errorMessage?: string | null,
): boolean {
  if (errorCode === 'repository_reset_required') {
    return true;
  }
  const msg = errorMessage ?? '';
  return (
    msg.includes('repository_reset_required') ||
    msg.includes('Pull first to align') ||
    msg.includes('Pull to archive this generation') ||
    msg.includes('Pull to align')
  );
}

/** Strip the machine-readable prefix from a failed-job error for display. */
export function formatFailedSyncErrorMessage(
  errorMessage?: string | null,
): string {
  if (!errorMessage) {
    return '';
  }
  return errorMessage
    .replace(/^repository_reset_required(?:\s+server_generation=\d+)?:\s*/i, '')
    .trim();
}

export function failedJobRecoveryCopy(options: {
  failed: boolean;
  repositoryReset: boolean;
}): string {
  if (!options.failed) {
    return '';
  }
  if (options.repositoryReset) {
    return 'The server repository was reset, so this device is still on the previous generation. Pull archives that local data (kept under previous_generations) and aligns — you do not need to discard this job first.';
  }
  return 'Clear this failed sync, then retry — or use Pull, which clears it for you.';
}
