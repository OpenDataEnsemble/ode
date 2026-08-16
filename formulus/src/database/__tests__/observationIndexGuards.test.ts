/**
 * Guards that keep an unusable index from silently answering queries.
 *
 * The failure this protects against is not an error but an empty result set:
 * a declared key routes a query into `observation_index`, and if the index was
 * never built, was emptied by a database wipe, or cannot represent the value,
 * every predicate simply matches nothing.
 */
const configIndexes: Array<Record<string, unknown>> = [];

jest.mock('../../database/database', () => ({
  database: {
    write: jest.fn(async (fn: () => Promise<void>) => fn()),
    adapter: { unsafeExecute: jest.fn(async () => undefined) },
    get: jest.fn(() => ({
      query: jest.fn(() => ({ unsafeFetchRaw: jest.fn(async () => []) })),
    })),
  },
}));

jest.mock('../../webview/FormulusMessageHandlers', () => ({
  appEvents: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('../../services/AppConfigService', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => ({
      loadConfig: jest.fn(async () => undefined),
      getConfig: jest.fn(() => ({ observationIndexes: configIndexes })),
    })),
  },
}));

import ObservationIndexService, {
  computeDefsSignature,
  deleteIndexSqls,
  extractIndexRows,
  INDEX_WRITE_BATCH_SIZE,
  insertIndexSqls,
} from '../../services/ObservationIndexService';

const EMPTY_SIGNATURE = computeDefsSignature([]);

/** Rows handed to successive `unsafeFetchRaw` calls, in order. */
const rawResults: unknown[][] = [];

const mockDb = {
  write: jest.fn(async (fn: () => Promise<void>) => fn()),
  adapter: { unsafeExecute: jest.fn(async () => undefined) },
  get: jest.fn(() => ({
    query: jest.fn(() => ({
      unsafeFetchRaw: jest.fn(async () => rawResults.shift() ?? []),
    })),
  })),
};

describe('ObservationIndexService guards', () => {
  let service: ObservationIndexService;
  let warn: jest.SpyInstance;

  beforeAll(async () => {
    service = ObservationIndexService.getInstance(mockDb as never);
    // The constructor kicks off a bootstrap rebuild; let it settle so it does
    // not consume the rows queued by individual tests.
    await service.ensureInitialRebuild();
  });

  beforeEach(() => {
    rawResults.length = 0;
    configIndexes.length = 0;
    service.reset();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  describe('getIndexDefs', () => {
    it('keeps definitions with a top-level key and path', () => {
      configIndexes.push({ key: 'hh_id', path: '$.hh_id' });
      expect(service.getIndexDefs()).toEqual([
        { key: 'hh_id', path: '$.hh_id' },
      ]);
    });

    it('drops definitions missing a key or a path', () => {
      configIndexes.push(
        { key: '', path: '$.skip' },
        { key: 'hh_id', path: '' },
      );
      expect(service.getIndexDefs()).toEqual([]);
    });

    it('drops a nested path, which the extractor cannot read', () => {
      // Extraction reads data['a.b'] rather than data.a.b, so a nested
      // definition writes no rows while still routing queries to the index.
      configIndexes.push({ key: 'a.b', path: '$.a.b' });
      expect(service.getIndexDefs()).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('declares nested path'),
      );
    });

    it('warns about a nested path only once', () => {
      configIndexes.push({ key: 'a.b', path: '$.a.b' });
      service.getIndexDefs();
      service.getIndexDefs();
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('isIndexUsable', () => {
    function queueUsableIndex(): void {
      rawResults.push(
        [{ active_generation: 1 }],
        [{ present: 1 }],
        [
          {
            active_generation: 1,
            last_rebuild_at: '2026-01-01',
            defs_signature: EMPTY_SIGNATURE,
          },
        ],
      );
    }

    it('reports true when rows exist and the stored signature matches', async () => {
      queueUsableIndex();
      await expect(service.isIndexUsable()).resolves.toBe(true);
    });

    it('reports false when the active generation is empty', async () => {
      rawResults.push([{ active_generation: 1 }], [{ present: 0 }]);
      await expect(service.isIndexUsable()).resolves.toBe(false);
    });

    it('reports false when rows exist but were built from different definitions', async () => {
      rawResults.push(
        [{ active_generation: 1 }],
        [{ present: 1 }],
        [
          {
            active_generation: 1,
            last_rebuild_at: '2026-01-01',
            defs_signature: 'stale-bundle',
          },
        ],
      );
      await expect(service.isIndexUsable()).resolves.toBe(false);
    });

    it('re-checks after a negative answer so recovery is picked up', async () => {
      rawResults.push([{ active_generation: 1 }], [{ present: 0 }]);
      await expect(service.isIndexUsable()).resolves.toBe(false);

      queueUsableIndex();
      await expect(service.isIndexUsable()).resolves.toBe(true);
    });

    it('caches a positive answer instead of querying on every call', async () => {
      queueUsableIndex();
      await expect(service.isIndexUsable()).resolves.toBe(true);

      // No rows queued: a second query would read the empty queue and report
      // false, so answering true proves the result was cached.
      await expect(service.isIndexUsable()).resolves.toBe(true);
    });

    it('forgets the cached answer after reset, which follows a database wipe', async () => {
      queueUsableIndex();
      await expect(service.isIndexUsable()).resolves.toBe(true);

      service.reset();
      await expect(service.isIndexUsable()).resolves.toBe(false);
    });
  });

  describe('extractIndexRows', () => {
    const defs = [
      { key: 'hh_id', path: '$.hh_id' },
      { key: 'af', path: '$.af' },
    ];

    it('parses JSON once and emits a row per matching key', () => {
      const { rows, nonScalarKeys } = extractIndexRows(
        'obs-1',
        'household',
        JSON.stringify({ hh_id: 'HH-1', af: 12 }),
        defs,
        1,
      );
      expect(nonScalarKeys).toEqual([]);
      expect(rows).toEqual([
        {
          id: 'obs-1:hh_id:1',
          observationId: 'obs-1',
          indexKey: 'hh_id',
          generation: 1,
          valueText: 'HH-1',
          valueNum: null,
        },
        {
          id: 'obs-1:af:1',
          observationId: 'obs-1',
          indexKey: 'af',
          generation: 1,
          valueText: null,
          valueNum: 12,
        },
      ]);
    });

    it('accepts an already-parsed object so pull can skip JSON.parse', () => {
      const { rows } = extractIndexRows(
        'obs-1',
        'household',
        { hh_id: 'HH-1' },
        [defs[0]],
        1,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].valueText).toBe('HH-1');
    });

    it('returns no rows for invalid JSON', () => {
      expect(
        extractIndexRows('obs-1', 'household', '{not-json', defs, 1),
      ).toEqual({ rows: [], nonScalarKeys: [] });
    });
  });

  describe('index SQL helpers', () => {
    it('deletes a batch with one IN list', () => {
      expect(deleteIndexSqls(['obs-1', 'obs-2'], 1)).toEqual([
        [
          'DELETE FROM observation_index WHERE observation_id IN (?,?) AND index_generation = ?',
          ['obs-1', 'obs-2', 1],
        ],
      ]);
    });

    it('inserts many EAV rows in one VALUES list', () => {
      const sqls = insertIndexSqls([
        {
          id: 'obs-1:hh_id:1',
          observationId: 'obs-1',
          indexKey: 'hh_id',
          generation: 1,
          valueText: 'HH-1',
          valueNum: null,
        },
        {
          id: 'obs-2:hh_id:1',
          observationId: 'obs-2',
          indexKey: 'hh_id',
          generation: 1,
          valueText: 'HH-2',
          valueNum: null,
        },
      ]);
      expect(sqls).toHaveLength(1);
      expect(sqls[0][0]).toBe(
        'INSERT INTO observation_index (id, observation_id, index_key, index_generation, value_text, value_num) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)',
      );
      expect(sqls[0][1]).toEqual([
        'obs-1:hh_id:1',
        'obs-1',
        'hh_id',
        1,
        'HH-1',
        null,
        'obs-2:hh_id:1',
        'obs-2',
        'hh_id',
        1,
        'HH-2',
        null,
      ]);
    });
  });

  describe('incrementalReindexMany', () => {
    it('flushes in bounded writes instead of one statement list for the whole page', async () => {
      configIndexes.push({ key: 'hh_id', path: '$.hh_id' });
      const rows = Array.from(
        { length: INDEX_WRITE_BATCH_SIZE + 50 },
        (_, i) => ({
          observationId: `obs-${i}`,
          formType: 'household',
          dataJson: JSON.stringify({ hh_id: `HH-${i}` }),
        }),
      );
      rawResults.push([{ active_generation: 1 }]);
      mockDb.write.mockClear();
      mockDb.adapter.unsafeExecute.mockClear();
      const onProgress = jest.fn();

      await service.incrementalReindexMany(rows, onProgress);

      expect(mockDb.write).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith({
        current: 0,
        total: INDEX_WRITE_BATCH_SIZE + 50,
      });
      expect(onProgress).toHaveBeenCalledWith({
        current: INDEX_WRITE_BATCH_SIZE,
        total: INDEX_WRITE_BATCH_SIZE + 50,
      });
      expect(onProgress).toHaveBeenLastCalledWith({
        current: INDEX_WRITE_BATCH_SIZE + 50,
        total: INDEX_WRITE_BATCH_SIZE + 50,
      });

      const firstFlush = mockDb.adapter.unsafeExecute.mock.calls[0][0]
        .sqls as Array<[string, unknown[]]>;
      expect(firstFlush[0][0]).toMatch(
        /^DELETE FROM observation_index WHERE observation_id IN \(/,
      );
      expect(firstFlush[0][1]).toHaveLength(INDEX_WRITE_BATCH_SIZE + 1);
      expect(firstFlush[1][0]).toMatch(
        /^INSERT INTO observation_index \(id, observation_id, index_key, index_generation, value_text, value_num\) VALUES /,
      );
      expect(firstFlush[1][0]).toContain('(?, ?, ?, ?, ?, ?),');
    });
  });
});
