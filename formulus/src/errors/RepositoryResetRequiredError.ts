import type { AxiosError } from 'axios';

/** Matches Synkronus `handlers.CodeRepositoryResetRequired` / OpenAPI error `code`. */
export const CODE_REPOSITORY_RESET_REQUIRED = 'repository_reset_required';

/**
 * Thrown when the server rejects sync (HTTP 409) because the client's
 * repository epoch no longer matches (e.g. after an admin hard reset).
 */
export class RepositoryResetRequiredError extends Error {
  /** Server epoch from the `x-repository-generation` response header, if present. */
  readonly serverRepositoryGeneration?: number;

  constructor(message?: string, serverRepositoryGeneration?: number) {
    super(
      message ??
        'The server data repository was reset. Clear local data and sync again.',
    );
    this.name = 'RepositoryResetRequiredError';
    this.serverRepositoryGeneration = serverRepositoryGeneration;
  }
}

export const isRepositoryResetRequiredError = (
  e: unknown,
): e is RepositoryResetRequiredError =>
  e instanceof RepositoryResetRequiredError;

/**
 * If `error` is an Axios 409 with `code: repository_reset_required`, returns the mapped error; otherwise null.
 */
export function parseRepositoryResetFromAxios(
  error: unknown,
): RepositoryResetRequiredError | null {
  const ax = error as AxiosError<{
    code?: string;
    message?: string;
    error?: string;
  }>;
  if (ax.response?.status !== 409) return null;
  const code = ax.response?.data?.code;
  if (code !== CODE_REPOSITORY_RESET_REQUIRED) {
    console.warn(
      '[RepositoryGeneration] HTTP 409 but sync error code is not repository_reset_required; client will not show repository-reset recovery.',
      {
        code,
        message: ax.response?.data?.message,
        data: ax.response?.data,
      },
    );
    return null;
  }

  const headerRaw = ax.response?.headers?.['x-repository-generation'];
  const headerStr = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  const serverGenParsed = headerStr != null ? Number(headerStr) : Number.NaN;
  const serverRepositoryGeneration = Number.isFinite(serverGenParsed)
    ? serverGenParsed
    : undefined;

  const bodyMsg =
    ax.response?.data?.message || ax.response?.data?.error || undefined;

  return new RepositoryResetRequiredError(
    typeof bodyMsg === 'string' ? bodyMsg : undefined,
    serverRepositoryGeneration,
  );
}
