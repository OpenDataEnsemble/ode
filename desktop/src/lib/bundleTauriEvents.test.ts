import { describe, expect, it } from 'vitest';
import { bundleBannerLineFromProgress } from './bundleTauriEvents';
import type { BundleApplyProgressPayload } from '../types/domain';

function payload(
  partial: Partial<BundleApplyProgressPayload> &
    Pick<BundleApplyProgressPayload, 'phase'>,
): BundleApplyProgressPayload {
  return {
    jobId: 'job-1',
    done: 0,
    total: 0,
    message: 'Working…',
    ...partial,
  };
}

describe('bundleBannerLineFromProgress', () => {
  it('includes byte detail when present', () => {
    expect(
      bundleBannerLineFromProgress(
        payload({
          phase: 'downloading',
          message: 'Downloading bundle from server…',
          detail: '12.4 / 48.2 MB',
        }),
      ),
    ).toBe('Downloading bundle from server… — 12.4 / 48.2 MB');
  });

  it('appends fraction when total is known', () => {
    expect(
      bundleBannerLineFromProgress(
        payload({
          phase: 'extracting',
          message: 'Extracting bundle…',
          done: 3,
          total: 10,
        }),
      ),
    ).toBe('Extracting bundle… (3/10)');
  });
});
