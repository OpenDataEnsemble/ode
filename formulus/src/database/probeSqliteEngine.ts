import { Database, Q } from '@nozbe/watermelondb';
import { logger } from '../diagnostics/logger';

export type SqliteEngineReport = {
  dispatcher: string;
  sqliteVersion: string | null;
  jsonExtract: boolean;
  jsiBinding: boolean;
};

type SqliteAdapterLike = {
  _dispatcherType?: string;
  initializingPromise?: Promise<void>;
};

function getUnderlyingAdapter(db: Database): SqliteAdapterLike | undefined {
  return (db.adapter as { underlyingAdapter?: SqliteAdapterLike })
    .underlyingAdapter;
}

function hasJsiBinding(): boolean {
  return (
    typeof (globalThis as { nativeWatermelonCreateAdapter?: unknown })
      .nativeWatermelonCreateAdapter === 'function'
  );
}

async function rawQuery(
  db: Database,
  sql: string,
): Promise<Record<string, unknown>[]> {
  return (await db
    .get('observations')
    .query(Q.unsafeSqlQuery(sql))
    .unsafeFetchRaw()) as Record<string, unknown>[];
}

function readText(
  row: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = row?.[key];
  if (value == null) {
    return null;
  }
  return String(value);
}

export function describeSqliteEngine(report: SqliteEngineReport): string {
  return `sqlite engine dispatcher=${report.dispatcher} version=${
    report.sqliteVersion ?? 'unknown'
  } json_extract=${report.jsonExtract ? 'ok' : 'missing'} jsiBinding=${
    report.jsiBinding ? 'yes' : 'no'
  }`;
}

export function sqliteEngineLogLevel(
  report: SqliteEngineReport,
): 'info' | 'warn' | 'error' {
  if (!report.jsonExtract) {
    return 'error';
  }
  if (report.dispatcher !== 'jsi') {
    return 'warn';
  }
  return 'info';
}

export async function probeSqliteEngine(
  db: Database,
): Promise<SqliteEngineReport> {
  const adapter = getUnderlyingAdapter(db);
  if (adapter?.initializingPromise) {
    await adapter.initializingPromise;
  }

  const dispatcher = adapter?._dispatcherType ?? 'unknown';
  const jsiBinding = hasJsiBinding();
  let sqliteVersion: string | null = null;
  let jsonExtract = false;

  try {
    const rows = await rawQuery(
      db,
      'SELECT sqlite_version() AS sqlite_version',
    );
    sqliteVersion = readText(rows[0], 'sqlite_version');
  } catch (error) {
    logger.warn(
      'db',
      error instanceof Error ? error.message : 'sqlite_version() probe failed',
    );
  }

  try {
    const rows = await rawQuery(
      db,
      `SELECT json_extract('{"a":1}', '$.a') AS json_ok`,
    );
    jsonExtract = readText(rows[0], 'json_ok') === '1';
  } catch {
    jsonExtract = false;
  }

  return { dispatcher, sqliteVersion, jsonExtract, jsiBinding };
}

export async function logSqliteEngine(
  db: Database,
): Promise<SqliteEngineReport> {
  const report = await probeSqliteEngine(db);
  const level = sqliteEngineLogLevel(report);
  logger[level]('db', describeSqliteEngine(report), {
    phase: 'sqlite_probe',
    success: report.jsonExtract && report.dispatcher === 'jsi',
  });
  return report;
}
