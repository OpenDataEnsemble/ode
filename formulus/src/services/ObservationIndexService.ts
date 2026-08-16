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

/**
 * Map a JSON scalar onto the index columns, or null when it should not be
 * indexed at all.
 *
 * Numbers go to `value_num` and other scalars to `value_text`; the query
 * compiler encodes the same split, so changing it here silently changes query
 * results. Arrays and objects are deliberately excluded: stringifying them
 * produced rows like `"[object Object],[object Object]"` that no query could
 * ever match, since a scalar filter compares against the whole blob and an
 * `any` filter goes through `json_each` instead. The row was pure write cost
 * with a misleading appearance of coverage.
 */
function scalarToColumns(
  val: unknown,
  valueType?: string,
): { valueText: string | null; valueNum: number | null } | null {
  if (val == null) return null;
  if (valueType === 'number' || typeof val === 'number') {
    const n = Number(val);
    if (!Number.isNaN(n)) return { valueText: null, valueNum: n };
  }
  if (typeof val === 'string') return { valueText: val, valueNum: null };
  if (typeof val === 'boolean')
    return { valueText: String(val), valueNum: null };
  return null;
}

/**
 * Only top-level keys can be indexed.
 *
 * Extraction reads `data[key]`, so a nested path yields undefined and writes no
 * rows — while the declared key still routes queries to the index, where they
 * match nothing. Rejecting the definition instead keeps those queries on the
 * json_extract path, which handles nesting correctly.
 */
function isSupportedIndexPath(path: string): boolean {
  const key = jsonPathToKey(path);
  return key.length > 0 && !key.includes('.') && !key.includes('[');
}

/**
 * A stable fingerprint of the index definitions a rebuild was run against.
 *
 * Stored alongside the rows so `last_rebuild_at` stops being the only evidence
 * that the index is current. A timestamp records that *a* rebuild happened; it
 * cannot distinguish an index built from today's definitions from one built
 * from the previous bundle's, nor a completed rebuild from one the app died
 * halfway through. Comparing signatures makes both cases self-correcting: the
 * next launch sees a mismatch and rebuilds.
 *
 * Order-independent, so merely reordering entries in app.config.json does not
 * trigger a rebuild of every observation on every device.
 */
export function computeDefsSignature(defs: ObservationIndexDef[]): string {
  const normalized = defs
    .map(def => ({
      key: def.key,
      path: def.path,
      formTypes: [...(def.formTypes ?? [])].sort(),
      valueType: def.valueType ?? null,
      expressionIndex: def.enableExpressionIndex !== false,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return JSON.stringify(normalized);
}

/**
 * Yield to the event loop so React Native can paint.
 *
 * A rebuild walks every observation and parses its JSON once per definition.
 * Left as one uninterrupted loop that work blocks the JS thread, which freezes
 * the UI — including whatever spinner is meant to show the rebuild running.
 */
function yieldToUi(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/** Observations read per batch between yields. */
const REBUILD_BATCH_SIZE = 200;

export interface IndexRebuildProgress {
  /** Observations processed so far. */
  current: number;
  /** Total observations to process. */
  total: number;
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
  private indexUsable = false;
  private readonly warnedOnce = new Set<string>();

  private constructor(db: Database) {
    this.db = db;
    // The rebuild that follows a bundle update is driven by SyncService via
    // `rebuildForBundleUpdate`, which awaits it and reports progress. It used
    // to be a fire-and-forget listener here: the sync reported "complete" while
    // the rebuild was still running, and any failure went to a console warning
    // that nothing acted on. `bundleUpdated` still fires for the other
    // listeners; it just no longer owns the rebuild.
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
    return (cfg?.observationIndexes ?? []).filter(d => {
      if (!d.key || !d.path) return false;
      if (!isSupportedIndexPath(d.path)) {
        this.warnOnce(
          `path:${d.key}`,
          `[ObservationIndexService] index "${d.key}" declares nested path "${d.path}"; only top-level keys can be indexed, so queries on it will use json_extract`,
        );
        return false;
      }
      return true;
    });
  }

  /**
   * Whether queries may trust `observation_index` for the active generation.
   *
   * A declared key routes a query through the index, so an index that cannot be
   * trusted turns every predicate on it into a silent wrong answer rather than
   * an error. Two ways that happens:
   *
   * - **No rows.** Never built, emptied by a database wipe, or abandoned by a
   *   failed rebuild. Every indexed predicate matches nothing.
   * - **Rows built from different definitions.** A bundle changed the declared
   *   indexes and the rebuild did not finish. The rows look healthy and are
   *   quietly answering for the previous bundle's schema.
   *
   * Either way the caller drops back to json_extract, which is slower but reads
   * the observation JSON directly and is therefore always right.
   *
   * Only the negative answer is re-checked. A usable index stays usable until a
   * rebuild or a wipe, and both clear this flag.
   */
  async isIndexUsable(): Promise<boolean> {
    if (this.indexUsable) return true;

    const generation = await this.readActiveGeneration();
    const rows = await this.query<{ present: number }>(
      'SELECT EXISTS(SELECT 1 FROM observation_index WHERE index_generation = ?) AS present',
      [generation],
    );
    if ((rows[0]?.present ?? 0) !== 1) {
      this.indexUsable = false;
      return false;
    }

    const expected = computeDefsSignature(this.getIndexDefs());
    const stored = (await this.getStatus()).defsSignature;
    if (stored !== expected) {
      this.warnOnce(
        'signature-mismatch',
        '[ObservationIndexService] index rows were built from different index definitions — falling back to json_extract until a rebuild completes',
      );
      this.indexUsable = false;
      return false;
    }

    this.indexUsable = true;
    return true;
  }

  /**
   * Forget everything cached about the index.
   *
   * `unsafeResetDatabase` recreates the index tables empty, but this singleton
   * survives it and would otherwise report a rebuild it no longer has.
   */
  reset(): void {
    this.initialRebuildPromise = null;
    this.initialRebuildFinished = false;
    this.indexUsable = false;
    this.warnedOnce.clear();
  }

  private warnOnce(token: string, message: string): void {
    if (this.warnedOnce.has(token)) return;
    this.warnedOnce.add(token);
    console.warn(message);
  }

  getInitialRebuildFinished(): boolean {
    return this.initialRebuildFinished;
  }

  async getStatus(): Promise<{
    activeGeneration: number;
    lastRebuildAt: string | null;
    defsSignature: string | null;
  }> {
    const rows = await this.query<{
      active_generation: number;
      last_rebuild_at: string | null;
      defs_signature: string | null;
    }>(
      'SELECT active_generation, last_rebuild_at, defs_signature FROM observation_index_meta WHERE id = ?',
      ['meta'],
    );
    const row = rows[0];
    return {
      activeGeneration: row?.active_generation ?? 1,
      lastRebuildAt: row?.last_rebuild_at ?? null,
      defsSignature: row?.defs_signature ?? null,
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

        // A populated table is not evidence that it is *current*. If the stored
        // signature does not match the definitions in force, the rows were
        // built from a previous bundle or by a rebuild that never finished, and
        // skipping here would leave that state in place permanently.
        const signatureMatches =
          status.defsSignature === computeDefsSignature(this.getIndexDefs());

        const skipBecausePopulated =
          Boolean(status.lastRebuildAt) && indexCount > 0 && signatureMatches;
        const skipBecauseEmptyInstall =
          observationCount === 0 &&
          Boolean(status.lastRebuildAt) &&
          signatureMatches;

        if (skipBecausePopulated) {
          this.initialRebuildFinished = true;
          return;
        }

        if (skipBecauseEmptyInstall) {
          this.initialRebuildFinished = true;
          return;
        }

        if (!signatureMatches && Boolean(status.lastRebuildAt)) {
          console.log(
            '[ObservationIndexService] index definitions changed or a previous rebuild did not complete — rebuilding',
          );
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

  /**
   * Reload the app config and rebuild the index against the definitions the
   * newly installed bundle declares.
   *
   * Callers are expected to await this and show progress. A bundle can add,
   * remove or retarget index definitions, and until the rebuild finishes every
   * query on a changed key falls back to json_extract.
   */
  async rebuildForBundleUpdate(
    onProgress?: (progress: IndexRebuildProgress) => void,
  ): Promise<void> {
    await AppConfigService.getInstance().loadConfig(/* force */ true);
    try {
      await this.rebuildAllIndexes({ onProgress });
    } catch (err) {
      // Leave no memoised "rebuild finished" behind: the next query re-runs
      // the check, sees the signature mismatch, and tries again.
      this.reset();
      throw err;
    }
  }

  async rebuildAllIndexes(options?: {
    onProgress?: (progress: IndexRebuildProgress) => void;
  }): Promise<{
    generation: number;
    lastRebuildAt: string | null;
  }> {
    const defs = this.getIndexDefs();
    const signature = computeDefsSignature(defs);
    // Always rebuild in-place on generation 1. The previous 1↔2 swap wrote
    // index rows to the new generation but the meta active_generation UPDATE
    // did not persist on device (runtime logs: gen-2 rows, activeGeneration=1).
    const gen = 1;
    // The rebuild empties the table before refilling it, and may legitimately
    // end with no rows at all, so any cached "index is healthy" answer is void.
    this.indexUsable = false;
    return this.db.write(async () => {
      await this.db.adapter.unsafeExecute({
        sqls: [
          [
            `INSERT OR IGNORE INTO observation_index_meta(id, active_generation) VALUES (?, ?)`,
            ['meta', gen],
          ],
        ],
      });

      const totalRows = await this.query<{ cnt: number }>(
        'SELECT COUNT(*) AS cnt FROM observations',
      );
      const total = totalRows[0]?.cnt ?? 0;

      const sqls: SqlStatement[] = [];
      sqls.push(['DELETE FROM observation_index', []]);

      // Read in batches and yield between them. The scan parses each
      // observation's JSON once per definition, which on a full repository is
      // long enough to freeze the UI if run as a single loop.
      let processed = 0;
      options?.onProgress?.({ current: 0, total });
      for (let offset = 0; offset < total; offset += REBUILD_BATCH_SIZE) {
        const batch = await this.query<{
          id: string;
          form_type: string;
          data: string;
        }>(
          'SELECT id, form_type, data FROM observations ORDER BY id LIMIT ? OFFSET ?',
          [REBUILD_BATCH_SIZE, offset],
        );
        if (!batch.length) break;

        for (const obs of batch) {
          this.collectReindexStatements(
            obs.id,
            obs.form_type ?? '',
            obs.data,
            defs,
            gen,
            sqls,
          );
        }

        processed += batch.length;
        options?.onProgress?.({ current: processed, total });
        await yieldToUi();
      }

      this.collectSqliteIndexStatements(defs, sqls);

      await this.flush(sqls);

      // Stamp meta in a separate execute; batched meta UPDATE was not sticking.
      // Written only after the rows land, so a rebuild interrupted before this
      // point leaves a signature that no longer matches and reruns next launch.
      await this.db.adapter.unsafeExecute({
        sqls: [
          [
            `UPDATE observation_index_meta
             SET active_generation = ?, building_generation = NULL, last_rebuild_at = datetime('now'), defs_signature = ?
             WHERE id = ?`,
            [gen, signature, 'meta'],
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
      const columns = scalarToColumns(val, def.valueType);
      if (!columns) {
        this.warnOnce(
          `nonscalar:${def.key}`,
          `[ObservationIndexService] index "${def.key}" holds a non-scalar value; it is not indexed, so only any() filters can match it`,
        );
        continue;
      }
      const { valueText, valueNum } = columns;
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
