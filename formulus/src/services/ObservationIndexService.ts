/**
 * Maintains local observation_index EAV rows (never synced).
 * Rebuild uses snapshot generation swap; incremental updates on save/sync.
 *
 * Implementation notes:
 *  - All write paths collect SQL into an array and flush once via
 *    `db.adapter.unsafeExecute({ sqls })` inside a single `db.write(...)`
 *    block. This avoids nested `db.write` calls, which deadlock under
 *    WatermelonDB's serial WorkQueue.
 *  - `ensureInitialRebuild()` runs on first instantiation to populate the
 *    index for users who already have synced rows from before indexing
 *    landed.
 */
import { Database, Q } from '@nozbe/watermelondb';
import { database } from '../database/database';
import { ObservationModel } from '../database/models/ObservationModel';
import AppConfigService from './AppConfigService';
import { appEvents } from '../webview/FormulusMessageHandlers';
import type { ObservationIndexDef } from '../types/AppConfig';

type SqlArg = string | number | boolean | null;
type SqlStatement = [string, SqlArg[]];

function formTypeMatches(formType: string, patterns?: string[]): boolean {
  if (!patterns?.length) return true;
  return patterns.some(p => {
    if (p.endsWith('*')) return formType.startsWith(p.slice(0, -1));
    return formType === p;
  });
}

function jsonPathToKey(path: string): string {
  return path.startsWith('$.') ? path.slice(2) : path;
}

function scalarToColumns(
  val: unknown,
  valueType?: string,
): { valueText: string | null; valueNum: number | null } {
  if (val == null) return { valueText: null, valueNum: null };
  if (valueType === 'number' || typeof val === 'number') {
    const n = Number(val);
    if (!Number.isNaN(n)) return { valueText: null, valueNum: n };
  }
  if (typeof val === 'string') return { valueText: val, valueNum: null };
  if (typeof val === 'boolean')
    return { valueText: String(val), valueNum: null };
  return { valueText: String(val), valueNum: null };
}

function extractScalar(dataJson: string, path: string): unknown {
  try {
    const data = JSON.parse(dataJson) as Record<string, unknown>;
    return data[jsonPathToKey(path)];
  } catch {
    return undefined;
  }
}

export class ObservationIndexService {
  private static instance: ObservationIndexService;
  private readonly db: Database;
  private initialRebuildPromise: Promise<void> | null = null;
  private initialRebuildFinished = false;

  private constructor(db: Database) {
    this.db = db;
    appEvents.addListener('bundleUpdated', () => {
      void (async () => {
        try {
          await AppConfigService.getInstance().loadConfig(/* force */ true);
          await this.rebuildAllIndexes();
        } catch (err) {
          console.warn(
            '[ObservationIndexService] rebuild after bundle failed:',
            err,
          );
        }
      })();
    });
    void this.ensureInitialRebuild();
  }

  static getInstance(db: Database = database): ObservationIndexService {
    if (!ObservationIndexService.instance) {
      ObservationIndexService.instance = new ObservationIndexService(db);
    }
    return ObservationIndexService.instance;
  }

  getIndexDefs(): ObservationIndexDef[] {
    const cfg = AppConfigService.getInstance().getConfig();
    return (cfg?.observationIndexes ?? []).filter(d => d.key && d.path);
  }

  getInitialRebuildFinished(): boolean {
    return this.initialRebuildFinished;
  }

  async getStatus(): Promise<{
    activeGeneration: number;
    lastRebuildAt: string | null;
  }> {
    const rows = await this.query<{
      active_generation: number;
      last_rebuild_at: string | null;
    }>(
      'SELECT active_generation, last_rebuild_at FROM observation_index_meta WHERE id = ?',
      ['meta'],
    );
    const row = rows[0];
    return {
      activeGeneration: row?.active_generation ?? 1,
      lastRebuildAt: row?.last_rebuild_at ?? null,
    };
  }

  /**
   * Run a one-time rebuild on app boot when the index looks empty or
   * unstamped. Memoised so repeated callers share a single in-flight
   * rebuild. Waits for `AppConfigService.loadConfig()` so the rebuild uses
   * up-to-date index defs.
   */
  ensureInitialRebuild(): Promise<void> {
    if (this.initialRebuildPromise) return this.initialRebuildPromise;
    this.initialRebuildPromise = (async () => {
      try {
        await AppConfigService.getInstance()
          .loadConfig()
          .catch(err => {
            console.warn(
              '[ObservationIndexService] loadConfig before initial rebuild failed:',
              err,
            );
          });

        const status = await this.getStatus();
        const indexCountRows = await this.query<{ cnt: number }>(
          'SELECT COUNT(*) AS cnt FROM observation_index',
        );
        const indexCount = indexCountRows[0]?.cnt ?? 0;

        const obsCountRows = await this.query<{ cnt: number }>(
          'SELECT COUNT(*) AS cnt FROM observations',
        );
        const observationCount = obsCountRows[0]?.cnt ?? 0;

        const skipBecausePopulated =
          Boolean(status.lastRebuildAt) && indexCount > 0;
        const skipBecauseEmptyInstall =
          observationCount === 0 && Boolean(status.lastRebuildAt);

        if (skipBecausePopulated) {
          this.initialRebuildFinished = true;
          return;
        }

        if (skipBecauseEmptyInstall) {
          this.initialRebuildFinished = true;
          return;
        }

        await this.rebuildAllIndexes();
        this.initialRebuildFinished = true;
      } catch (err) {
        console.warn('[ObservationIndexService] initial rebuild failed:', err);
        // Allow a future caller to retry.
        this.initialRebuildPromise = null;
      }
    })();
    return this.initialRebuildPromise;
  }

  async rebuildAllIndexes(): Promise<{
    generation: number;
    lastRebuildAt: string | null;
  }> {
    const defs = this.getIndexDefs();
    // Always rebuild in-place on generation 1. The previous 1↔2 swap wrote
    // index rows to the new generation but the meta active_generation UPDATE
    // did not persist on device (runtime logs: gen-2 rows, activeGeneration=1).
    const gen = 1;
    return this.db.write(async () => {
      await this.db.adapter.unsafeExecute({
        sqls: [
          [
            `INSERT OR IGNORE INTO observation_index_meta(id, active_generation) VALUES (?, ?)`,
            ['meta', gen],
          ],
        ],
      });

      const observations = await this.query<{
        id: string;
        form_type: string;
        data: string;
      }>('SELECT id, form_type, data FROM observations');

      const sqls: SqlStatement[] = [];
      sqls.push(['DELETE FROM observation_index', []]);

      for (const obs of observations) {
        this.collectReindexStatements(
          obs.id,
          obs.form_type ?? '',
          obs.data,
          defs,
          gen,
          sqls,
        );
      }

      this.collectSqliteIndexStatements(defs, sqls);

      await this.flush(sqls);

      // Stamp meta in a separate execute; batched meta UPDATE was not sticking.
      await this.db.adapter.unsafeExecute({
        sqls: [
          [
            `UPDATE observation_index_meta
             SET active_generation = ?, building_generation = NULL, last_rebuild_at = datetime('now')
             WHERE id = ?`,
            [gen, 'meta'],
          ],
        ],
      });

      const metaAfter = await this.getStatus();

      return {
        generation: gen,
        lastRebuildAt: metaAfter.lastRebuildAt,
      };
    });
  }

  async incrementalReindex(
    observationId: string,
    formType: string,
    dataJson: string,
  ): Promise<void> {
    const defs = this.getIndexDefs();
    if (!defs.length) return;
    await this.db.write(async () => {
      const generation = await this.readActiveGeneration();
      const sqls: SqlStatement[] = [];
      this.collectReindexStatements(
        observationId,
        formType,
        dataJson,
        defs,
        generation,
        sqls,
      );
      await this.flush(sqls);
    });
  }

  /**
   * Reindex many observations in a single batched write. Used by sync paths
   * that ingest large numbers of rows.
   */
  async incrementalReindexMany(
    rows: Array<{ observationId: string; formType: string; dataJson: string }>,
  ): Promise<void> {
    const defs = this.getIndexDefs();
    if (!defs.length || rows.length === 0) return;
    await this.db.write(async () => {
      const generation = await this.readActiveGeneration();
      const sqls: SqlStatement[] = [];
      for (const r of rows) {
        this.collectReindexStatements(
          r.observationId,
          r.formType,
          r.dataJson,
          defs,
          generation,
          sqls,
        );
      }
      await this.flush(sqls);
    });
  }

  /**
   * Read the active generation while a writer is in flight. Used by
   * incremental paths so they don't pin a stale generation when a rebuild
   * commits a swap concurrently.
   */
  private async readActiveGeneration(): Promise<number> {
    const rows = await this.query<{ active_generation: number }>(
      'SELECT active_generation FROM observation_index_meta WHERE id = ?',
      ['meta'],
    );
    return rows[0]?.active_generation ?? 1;
  }

  private collectReindexStatements(
    observationId: string,
    formType: string,
    dataJson: string,
    defs: ObservationIndexDef[],
    generation: number,
    out: SqlStatement[],
  ): void {
    out.push([
      'DELETE FROM observation_index WHERE observation_id = ? AND index_generation = ?',
      [observationId, generation],
    ]);
    for (const def of defs) {
      if (!formTypeMatches(formType, def.formTypes)) continue;
      const val = extractScalar(dataJson, def.path);
      if (val == null) continue;
      const { valueText, valueNum } = scalarToColumns(val, def.valueType);
      const rowId = `${observationId}:${def.key}:${generation}`;
      out.push([
        `INSERT OR REPLACE INTO observation_index
         (id, observation_id, index_key, index_generation, value_text, value_num)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [rowId, observationId, def.key, generation, valueText, valueNum],
      ]);
    }
  }

  private collectSqliteIndexStatements(
    defs: ObservationIndexDef[],
    out: SqlStatement[],
  ): void {
    for (const def of defs) {
      const safeKey = def.key.replace(/[^a-zA-Z0-9_]/g, '_');
      const idxName = `idx_${safeKey}_text`;
      out.push([`DROP INDEX IF EXISTS ${idxName}`, []]);
      out.push([
        `CREATE INDEX IF NOT EXISTS ${idxName} ON observation_index(value_text) WHERE index_key = '${def.key.replace(/'/g, "''")}'`,
        [],
      ]);
      if (def.enableExpressionIndex !== false) {
        const exprName = `data_${safeKey}`;
        const jsonPath = def.path.startsWith('$.') ? def.path : `$.${def.path}`;
        out.push([`DROP INDEX IF EXISTS ${exprName}`, []]);
        out.push([
          `CREATE INDEX IF NOT EXISTS ${exprName} ON observations(json_extract(data, '${jsonPath.replace(/'/g, "''")}'))`,
          [],
        ]);
      }
    }
  }

  private async flush(sqls: SqlStatement[]): Promise<void> {
    if (sqls.length === 0) return;
    await this.db.adapter.unsafeExecute({ sqls });
  }

  private observationsQuery() {
    return this.db.get<ObservationModel>('observations');
  }

  private async query<T extends Record<string, unknown>>(
    sql: string,
    args: SqlArg[] = [],
  ): Promise<T[]> {
    return (await this.observationsQuery()
      .query(Q.unsafeSqlQuery(sql, args))
      .unsafeFetchRaw()) as T[];
  }
}

export default ObservationIndexService;
