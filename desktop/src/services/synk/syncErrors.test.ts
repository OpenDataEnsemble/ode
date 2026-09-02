import { describe, expect, it } from 'vitest';
import { parseRetryAfter, SyncHttpError } from './syncErrors';

describe('sync auth errors', () => {
  it('parses Retry-After seconds and dates', () => {
    expect(parseRetryAfter('12')).toBe(12);
    expect(
      parseRetryAfter(
        'Wed, 21 Oct 2015 07:28:10 GMT',
        Date.parse('Wed, 21 Oct 2015 07:28:00 GMT'),
      ),
    ).toBe(10);
  });

  it('retains retry metadata without treating 429 as unauthorized', () => {
    const error = new SyncHttpError('rate limited', 429, 'refresh', 10);
    expect(error.retryAfterSeconds).toBe(10);
    expect(error.status).toBe(429);
  });
});
