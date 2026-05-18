/**
 * Maintains local observation_index EAV rows (never synced).
 * Rebuild uses snapshot generation swap; incremental updates on save/sync.
 */
import { Database, Q } from '@nozbe/watermelondb';
import { database } from '../database/database';
import { ObservationModel } from '../database/models/ObservationModel';
import AppConfigService from './AppConfigService';
import { appEvents } from '../webview/FormulusMessageHandlers';
import type { ObservationIndexDef } from '../types/AppConfig';

type SqlArg = string | number | boolean | null;

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

  private constructor(db: Database) {
    this.db = db;
    appEvents.addListener('bundleUpdated', () => {
      void this.rebuildAllIndexes().catch(err => {
        console.warn(
          '[ObservationIndexService] rebuild after bundle failed:',
          err,
        );
      });
    });
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

  async rebuildAllIndexes(): Promise<{
    generation: number;
    lastRebuildAt: string | null;
  }> {
    const defs = this.getIndexDefs();
    return this.db.write(async () => {
      const activeRows = await this.query<{ active_generation: number }>(
        'SELECT active_generation FROM observation_index_meta WHERE id = ?',
        ['meta'],
      );
      const active = activeRows[0]?.active_generation ?? 1;
      const newGen = active === 1 ? 2 : 1;

      await this.execute(
        'UPDATE observation_index_meta SET building_generation = ? WHERE id = ?',
        [newGen, 'meta'],
      );
      await this.execute(
        'DELETE FROM observation_index WHERE index_generation = ?',
        [newGen],
      );

      const observations = await this.query<{
        id: string;
        form_type: string;
        data: string;
      }>('SELECT id, form_type, data FROM observations');

      for (const obs of observations) {
        await this.reindexObservationRow(
          obs.id,
          obs.form_type ?? '',
          obs.data,
          defs,
          newGen,
        );
      }

      await this.recreateSqliteIndexes(defs);

      await this.execute(
        'DELETE FROM observation_index WHERE index_generation != ?',
        [newGen],
      );
      await this.execute(
        `UPDATE observation_index_meta
         SET active_generation = ?, building_generation = NULL, last_rebuild_at = datetime('now')
         WHERE id = ?`,
        [newGen, 'meta'],
      );

      const status = await this.getStatus();
      return { generation: newGen, lastRebuildAt: status.lastRebuildAt };
    });
  }

  async incrementalReindex(
    observationId: string,
    formType: string,
    dataJson: string,
  ): Promise<void> {
    const defs = this.getIndexDefs();
    if (!defs.length) return;
    const status = await this.getStatus();
    await this.db.write(async () => {
      await this.reindexObservationRow(
        observationId,
        formType,
        dataJson,
        defs,
        status.activeGeneration,
      );
    });
  }

  private async reindexObservationRow(
    observationId: string,
    formType: string,
    dataJson: string,
    defs: ObservationIndexDef[],
    generation: number,
  ): Promise<void> {
    await this.execute(
      'DELETE FROM observation_index WHERE observation_id = ? AND index_generation = ?',
      [observationId, generation],
    );
    for (const def of defs) {
      if (!formTypeMatches(formType, def.formTypes)) continue;
      const val = extractScalar(dataJson, def.path);
      if (val == null) continue;
      const { valueText, valueNum } = scalarToColumns(val, def.valueType);
      const rowId = `${observationId}:${def.key}:${generation}`;
      await this.execute(
        `INSERT OR REPLACE INTO observation_index
         (id, observation_id, index_key, index_generation, value_text, value_num)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [rowId, observationId, def.key, generation, valueText, valueNum],
      );
    }
  }

  private async recreateSqliteIndexes(
    defs: ObservationIndexDef[],
  ): Promise<void> {
    for (const def of defs) {
      const safeKey = def.key.replace(/[^a-zA-Z0-9_]/g, '_');
      const idxName = `idx_${safeKey}_text`;
      await this.execute(`DROP INDEX IF EXISTS ${idxName}`);
      await this.execute(
        `CREATE INDEX IF NOT EXISTS ${idxName} ON observation_index(value_text) WHERE index_key = '${def.key.replace(/'/g, "''")}'`,
      );
      if (def.enableExpressionIndex !== false) {
        const exprName = `data_${safeKey}`;
        const jsonPath = def.path.startsWith('$.') ? def.path : `$.${def.path}`;
        await this.execute(`DROP INDEX IF EXISTS ${exprName}`);
        await this.execute(
          `CREATE INDEX IF NOT EXISTS ${exprName} ON observations(json_extract(data, '${jsonPath.replace(/'/g, "''")}'))`,
        );
      }
    }
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

  private async execute(sql: string, args: SqlArg[] = []): Promise<void> {
    await this.db.write(async () => {
      await this.db.adapter.unsafeExecute({
        sqls: [[sql, args]],
      });
    });
  }
}

export default ObservationIndexService;
