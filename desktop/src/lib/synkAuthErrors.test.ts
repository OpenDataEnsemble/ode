import { describe, expect, it } from 'vitest';
import { ResponseError } from '../generated/synkronus-client';
import { isUnauthorizedSynkError } from './synkAuthErrors';

describe('isUnauthorizedSynkError', () => {
  it('detects ResponseError 401', () => {
    const err = new ResponseError(
      new Response('nope', { status: 401 }),
      'unauthorized',
    );
    expect(isUnauthorizedSynkError(err)).toBe(true);
  });

  it('detects message heuristics', () => {
    expect(isUnauthorizedSynkError(new Error('HTTP 401 Unauthorized'))).toBe(
      true,
    );
    expect(isUnauthorizedSynkError(new Error('network down'))).toBe(false);
  });
});
