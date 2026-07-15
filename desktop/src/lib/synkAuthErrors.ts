import { ResponseError } from '../generated/synkronus-client';

export function isUnauthorizedSynkError(error: unknown): boolean {
  if (error instanceof ResponseError) {
    return error.response.status === 401;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return /\b401\b/.test(msg) || /unauthorized/i.test(msg);
}
