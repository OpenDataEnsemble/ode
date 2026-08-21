import {
  buildObservationListSql,
  buildObservationPagerItems,
  formatObservationIdShort,
  OBSERVATION_LIST_PAGE_SIZE,
} from '../observationListQuery';
import { MIN_VALID_SYNCED_AT_MS } from '../../utils/observationSyncStatus';

describe('buildObservationListSql', () => {
  it('selects envelope columns only and pages with LIMIT/OFFSET', () => {
    const built = buildObservationListSql({ page: 3 });
    expect(built.listSql).toContain(
      'SELECT observation_id, form_type, created_at, updated_at, synced_at, author',
    );
    expect(built.listSql).not.toContain(' data');
    expect(built.listSql).toContain('LIMIT ? OFFSET ?');
    expect(built.listParams.slice(-2)).toEqual([
      OBSERVATION_LIST_PAGE_SIZE,
      2 * OBSERVATION_LIST_PAGE_SIZE,
    ]);
    expect(built.countSql).toBe(
      'SELECT COUNT(*) AS cnt FROM observations WHERE deleted = 0',
    );
  });

  it('filters form type, pending sync, and escaped search', () => {
    const built = buildObservationListSql({
      page: 1,
      formType: 'censo_milda',
      syncStatus: 'pending',
      search: 'ab%_c',
    });
    expect(built.listSql).toContain('form_type = ?');
    expect(built.listSql).toContain('updated_at > synced_at');
    expect(built.listParams).toContain('censo_milda');
    expect(built.listParams).toContain(MIN_VALID_SYNCED_AT_MS);
    expect(built.listParams).toContain('%ab\\%\\_c%');
  });
});

describe('buildObservationPagerItems', () => {
  it('shows 1, 2, …, last on page one', () => {
    const labels = buildObservationPagerItems(1, 10).map(item =>
      item.kind === 'page'
        ? `${item.page}${item.current ? '*' : ''}`
        : item.kind === 'ellipsis'
          ? '…'
          : item.kind,
    );
    expect(labels).toEqual(['prev', '1*', '2', '…', '10', 'next']);
  });

  it('shows n-1, n, n+1 when not on page one', () => {
    const labels = buildObservationPagerItems(4, 10).map(item =>
      item.kind === 'page'
        ? `${item.page}${item.current ? '*' : ''}`
        : item.kind,
    );
    expect(labels).toEqual(['prev', '3', '4*', '5', 'next']);
  });
});

describe('formatObservationIdShort', () => {
  it('keeps short ids and clips long ones', () => {
    expect(formatObservationIdShort('abcd1234')).toBe('abcd1234');
    expect(formatObservationIdShort('abcdefghijklmnop')).toBe('abcd…mnop');
  });
});
