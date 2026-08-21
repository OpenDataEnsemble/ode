import {
  getSyncProgressCardTitle,
  getSyncProgressDetailsForDisplay,
  shouldShowSyncProgressCurrentItem,
  shouldShowSyncProgressPercent,
} from '../syncProgressUi';
import { ensureI18nForTests } from '../../testUtils/i18nTestSetup';

beforeAll(async () => {
  await ensureI18nForTests();
});

describe('syncProgressUi', () => {
  it('passes through localized details', () => {
    expect(
      getSyncProgressDetailsForDisplay({
        phase: 'pull_observations',
        current: 0,
        total: 0,
        indeterminate: true,
        details: '1,500 observations downloaded',
      }),
    ).toBe('1,500 observations downloaded');
  });

  it('leaves attachment count text unchanged', () => {
    expect(
      getSyncProgressDetailsForDisplay({
        phase: 'pull_attachments',
        current: 10,
        total: 100,
        details: '10 of 100',
      }),
    ).toBe('10 of 100');
  });

  it('hides percent and filename for attachment phases', () => {
    const progress = {
      phase: 'pull_attachments' as const,
      current: 43,
      total: 100,
      details: '1497 of 3515',
      currentItem: 'file.jpg',
    };
    expect(shouldShowSyncProgressPercent(progress)).toBe(false);
    expect(shouldShowSyncProgressCurrentItem(progress)).toBe(false);
  });

  it('hides percent for app bundle (bar only)', () => {
    expect(
      shouldShowSyncProgressPercent({
        phase: 'app_bundle',
        current: 95,
        total: 100,
      }),
    ).toBe(false);
  });

  it('uses the index-rebuild title even during a bundle update', () => {
    expect(
      getSyncProgressCardTitle(
        {
          phase: 'index_rebuild',
          current: 200,
          total: 1500,
          details: '200 of 1500',
        },
        'update',
      ),
    ).toBe('Preparing data for search');
  });

  it('uses the index-rebuild title for a full rebuild (bundle update path)', () => {
    expect(
      getSyncProgressCardTitle(
        {
          phase: 'index_rebuild',
          current: 200,
          total: 800,
        },
        'sync',
      ),
    ).toBe('Preparing data for search');
  });
});
