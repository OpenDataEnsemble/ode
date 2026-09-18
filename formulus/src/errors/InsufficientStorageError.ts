/** User-facing copy when the device cannot hold the app-bundle download/extract. */
export const APP_BUNDLE_INSUFFICIENT_STORAGE_USER_MESSAGE =
  'Not enough storage space on this device to download and install the app bundle. Free up space and try again.';

/**
 * Thrown when free space is too low for a bundle install, or when a native
 * I/O error indicates the filesystem ran out of space.
 */
export class InsufficientStorageError extends Error {
  constructor(message: string = APP_BUNDLE_INSUFFICIENT_STORAGE_USER_MESSAGE) {
    super(message);
    this.name = 'InsufficientStorageError';
  }
}

export const isInsufficientStorageError = (
  error: unknown,
): error is InsufficientStorageError => {
  if (error instanceof InsufficientStorageError) {
    return true;
  }

  const ax = error as { code?: string; message?: string };
  const code = typeof ax.code === 'string' ? ax.code.toUpperCase() : '';
  if (code === 'ENOSPC' || code === 'EIO_NOSPC') {
    return true;
  }

  const message = (
    error instanceof Error ? error.message : String(ax.message ?? error ?? '')
  ).toLowerCase();

  return (
    message.includes('enospc') ||
    message.includes('no space left') ||
    message.includes('not enough space') ||
    message.includes('not enough disk space') ||
    message.includes('insufficient storage') ||
    message.includes('out of space') ||
    message.includes("there isn't enough space") ||
    message.includes('there is not enough space')
  );
};

/** Normalize native ENOSPC-style failures into InsufficientStorageError. */
export function asInsufficientStorageError(error: unknown): Error {
  if (error instanceof InsufficientStorageError) {
    return error;
  }
  if (isInsufficientStorageError(error)) {
    return new InsufficientStorageError();
  }
  return error instanceof Error ? error : new Error(String(error));
}
