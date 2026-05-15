import { describe, expect, it } from 'vitest';
import { productionPushConfirmDetail } from './syncUiCopy';

describe('productionPushConfirmDetail', () => {
  it('includes the dirty observation count', () => {
    expect(productionPushConfirmDetail(12)).toBe(
      'Push 12 pending observation(s) to production?',
    );
  });
});
