/**
 * Error thrown when Formulus version is incompatible with Synkronus server.
 * This error is thrown when the server responds with HTTP 426 Upgrade Required.
 */
export class VersionMismatchError extends Error {
  readonly synkronusVersion: string;

  constructor(message?: string, synkronusVersion = 'unknown') {
    super(
      message ??
        'This version of Formulus is not supported. Please update the app.',
    );
    this.name = 'VersionMismatchError';
    this.synkronusVersion = synkronusVersion;
  }
}

/**
 * Type guard to check if an error is a VersionMismatchError.
 */
export const isVersionMismatchError = (
  e: unknown,
): e is VersionMismatchError => e instanceof VersionMismatchError;
