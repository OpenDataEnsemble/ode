import { MIN_VALID_SYNCED_AT_MS } from '../utils/observationSyncStatus';
import type { SyncStatus } from '../components/common/SyncStatusButtons';

export const OBSERVATION_LIST_PAGE_SIZE = 15;

export type ObservationListRow = {
  observationId: string;
  formType: string;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date | null;
  author: string | null;
};

export type ObservationListQuery = {
  formType?: string | null;
  syncStatus?: SyncStatus;
  search?: string;
  page: number;
  pageSize?: number;
};

export type ObservationListPage = {
  rows: ObservationListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const LIST_COLUMNS = `observation_id, form_type, created_at, updated_at, synced_at, author`;

function likeContains(term: string): string {
  return `%${term
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')}%`;
}

function appendFilters(
  where: string[],
  params: Array<string | number>,
  query: ObservationListQuery,
): void {
  where.push('deleted = 0');
  if (query.formType?.trim()) {
    where.push('form_type = ?');
    params.push(query.formType.trim());
  }
  if (query.syncStatus === 'synced') {
    where.push(
      'synced_at IS NOT NULL AND synced_at > ? AND updated_at <= synced_at',
    );
    params.push(MIN_VALID_SYNCED_AT_MS);
  } else if (query.syncStatus === 'pending') {
    where.push(
      '(synced_at IS NULL OR synced_at <= ? OR updated_at > synced_at)',
    );
    params.push(MIN_VALID_SYNCED_AT_MS);
  }
  const search = query.search?.trim();
  if (search) {
    const like = likeContains(search);
    where.push(
      "(observation_id LIKE ? ESCAPE '\\' OR form_type LIKE ? ESCAPE '\\' OR IFNULL(author, '') LIKE ? ESCAPE '\\')",
    );
    params.push(like, like, like);
  }
}

export function buildObservationListSql(query: ObservationListQuery): {
  listSql: string;
  listParams: Array<string | number>;
  countSql: string;
  countParams: Array<string | number>;
  page: number;
  pageSize: number;
  offset: number;
} {
  const pageSize = Math.max(1, query.pageSize ?? OBSERVATION_LIST_PAGE_SIZE);
  const page = Math.max(1, query.page);
  const offset = (page - 1) * pageSize;
  const where: string[] = [];
  const params: Array<string | number> = [];
  appendFilters(where, params, query);
  const whereSql = `WHERE ${where.join(' AND ')}`;
  return {
    listSql: `SELECT ${LIST_COLUMNS} FROM observations ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    listParams: [...params, pageSize, offset],
    countSql: `SELECT COUNT(*) AS cnt FROM observations ${whereSql}`,
    countParams: [...params],
    page,
    pageSize,
    offset,
  };
}

export function mapObservationListRow(
  row: Record<string, unknown>,
): ObservationListRow {
  const syncedRaw = row.synced_at;
  const syncedAt =
    syncedRaw == null || syncedRaw === '' ? null : new Date(Number(syncedRaw));
  return {
    observationId: String(row.observation_id ?? row.id ?? ''),
    formType: String(row.form_type ?? ''),
    createdAt: new Date(Number(row.created_at ?? 0)),
    updatedAt: new Date(Number(row.updated_at ?? 0)),
    syncedAt,
    author: row.author ? String(row.author) : null,
  };
}

export function formatObservationIdShort(id: string): string {
  if (id.length <= 8) {
    return id;
  }
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export type PagerItem =
  | { kind: 'prev' | 'next'; page: number; disabled: boolean }
  | { kind: 'page'; page: number; current: boolean }
  | { kind: 'ellipsis' };

/**
 * Page 1:  <  1  2  …  last  >
 * Other:   <  n-1  n  n+1  >
 */
export function buildObservationPagerItems(
  page: number,
  totalPages: number,
): PagerItem[] {
  const last = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), last);
  const items: PagerItem[] = [
    { kind: 'prev', page: current - 1, disabled: current <= 1 },
  ];
  if (current === 1) {
    items.push({ kind: 'page', page: 1, current: true });
    if (last >= 2) {
      items.push({ kind: 'page', page: 2, current: false });
    }
    if (last > 3) {
      items.push({ kind: 'ellipsis' });
    }
    if (last > 2) {
      items.push({ kind: 'page', page: last, current: false });
    }
  } else {
    items.push({ kind: 'page', page: current - 1, current: false });
    items.push({ kind: 'page', page: current, current: true });
    if (current < last) {
      items.push({ kind: 'page', page: current + 1, current: false });
    }
  }
  items.push({ kind: 'next', page: current + 1, disabled: current >= last });
  return items;
}
