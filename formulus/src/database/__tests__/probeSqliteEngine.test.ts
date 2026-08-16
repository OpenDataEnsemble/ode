import {
  describeSqliteEngine,
  probeSqliteEngine,
  sqliteEngineLogLevel,
} from '../probeSqliteEngine';

function mockDb(options: {
  dispatcher?: string;
  versionRows?: Record<string, unknown>[];
  jsonRows?: Record<string, unknown>[] | Error;
  jsiBinding?: boolean;
}) {
  let queryCount = 0;
  const unsafeFetchRaw = jest.fn(async () => {
    queryCount += 1;
    if (queryCount === 1) {
      return options.versionRows ?? [{ sqlite_version: '3.46.0' }];
    }
    if (options.jsonRows instanceof Error) {
      throw options.jsonRows;
    }
    return options.jsonRows ?? [{ json_ok: '1' }];
  });
  const db = {
    adapter: {
      underlyingAdapter: {
        _dispatcherType: options.dispatcher ?? 'jsi',
        initializingPromise: Promise.resolve(),
      },
    },
    get: jest.fn(() => ({
      query: jest.fn(() => ({ unsafeFetchRaw })),
    })),
  };
  if (options.jsiBinding) {
    (
      globalThis as { nativeWatermelonCreateAdapter?: () => unknown }
    ).nativeWatermelonCreateAdapter = () => ({});
  } else {
    delete (globalThis as { nativeWatermelonCreateAdapter?: () => unknown })
      .nativeWatermelonCreateAdapter;
  }
  return db;
}

describe('probeSqliteEngine', () => {
  afterEach(() => {
    delete (globalThis as { nativeWatermelonCreateAdapter?: () => unknown })
      .nativeWatermelonCreateAdapter;
  });

  it('describes a healthy bundled engine', () => {
    const report = {
      dispatcher: 'jsi',
      sqliteVersion: '3.46.0',
      jsonExtract: true,
      jsiBinding: true,
    };
    expect(describeSqliteEngine(report)).toBe(
      'sqlite engine dispatcher=jsi version=3.46.0 json_extract=ok jsiBinding=yes',
    );
    expect(sqliteEngineLogLevel(report)).toBe('info');
  });

  it('treats a system-sqlite fallback as a warning even when JSON1 exists', () => {
    expect(
      sqliteEngineLogLevel({
        dispatcher: 'asynchronous',
        sqliteVersion: '3.32.2',
        jsonExtract: true,
        jsiBinding: false,
      }),
    ).toBe('warn');
  });

  it('treats missing json_extract as an error', () => {
    expect(
      sqliteEngineLogLevel({
        dispatcher: 'asynchronous',
        sqliteVersion: '3.22.0',
        jsonExtract: false,
        jsiBinding: false,
      }),
    ).toBe('error');
    expect(
      describeSqliteEngine({
        dispatcher: 'asynchronous',
        sqliteVersion: '3.22.0',
        jsonExtract: false,
        jsiBinding: false,
      }),
    ).toContain('json_extract=missing');
  });

  it('probes dispatcher, version, json_extract, and JSI binding', async () => {
    const db = mockDb({ dispatcher: 'jsi', jsiBinding: true });
    const report = await probeSqliteEngine(db as never);
    expect(report).toEqual({
      dispatcher: 'jsi',
      sqliteVersion: '3.46.0',
      jsonExtract: true,
      jsiBinding: true,
    });
  });

  it('records json_extract as missing when the probe query fails', async () => {
    const db = mockDb({
      dispatcher: 'asynchronous',
      jsonRows: new Error('no such function: json_extract'),
      jsiBinding: false,
    });
    const report = await probeSqliteEngine(db as never);
    expect(report.jsonExtract).toBe(false);
    expect(report.dispatcher).toBe('asynchronous');
    expect(report.jsiBinding).toBe(false);
  });
});
