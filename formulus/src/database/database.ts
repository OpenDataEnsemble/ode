import { Database, Q } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schemas } from './schema';
import { ObservationModel } from './models/ObservationModel';
import {
  schemaMigrations,
  unsafeExecuteSql,
} from '@nozbe/watermelondb/Schema/migrations';
import { logger } from '../diagnostics/logger';
import { installWatermelonLogBridge } from './installWatermelonLogBridge';
import { logSqliteEngine } from './probeSqliteEngine';

import {
  getActiveProfile,
  assertProfileReady,
} from '../profiles/ProfileRuntime';
import { prepareProfileDatabase } from '../profiles/nativeProfileLifecycle';
import { profileActivity } from '../profiles/ProfileActivity';

// Define migrations
const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        // Add form_type_id column to observations table
        {
          type: 'add_columns',
          table: 'observations',
          columns: [{ name: 'form_type_id', type: 'string', isIndexed: true }],
        },
      ],
    },
    {
      toVersion: 3,
      steps: [
        // Add geolocation column to observations table
        {
          type: 'add_columns',
          table: 'observations',
          columns: [{ name: 'geolocation', type: 'string' }],
        },
      ],
    },
    {
      toVersion: 4,
      steps: [
        // Add author and device_id columns to observations table
        {
          type: 'add_columns',
          table: 'observations',
          columns: [
            { name: 'author', type: 'string' },
            { name: 'device_id', type: 'string' },
          ],
        },
      ],
    },
    {
      toVersion: 5,
      steps: [
        {
          type: 'add_columns',
          table: 'observations',
          columns: [{ name: 'tags', type: 'string' }],
        },
      ],
    },
    {
      toVersion: 6,
      steps: [
        unsafeExecuteSql(`
          CREATE TABLE IF NOT EXISTS observation_index_meta (
            id TEXT PRIMARY KEY NOT NULL,
            _status TEXT,
            _changed TEXT,
            active_generation INTEGER NOT NULL DEFAULT 1,
            building_generation INTEGER,
            last_rebuild_at TEXT
          );
          INSERT OR IGNORE INTO observation_index_meta(id, active_generation) VALUES ('meta', 1);

          CREATE TABLE IF NOT EXISTS observation_index (
            id TEXT PRIMARY KEY NOT NULL,
            _status TEXT,
            _changed TEXT,
            observation_id TEXT NOT NULL,
            index_key TEXT NOT NULL,
            index_generation INTEGER NOT NULL,
            value_text TEXT,
            value_num REAL
          );
          CREATE INDEX IF NOT EXISTS idx_observation_index_lookup
            ON observation_index(index_generation, index_key, value_text, observation_id);
          CREATE INDEX IF NOT EXISTS idx_observation_index_lookup_num
            ON observation_index(index_generation, index_key, value_num, observation_id);
        `),
      ],
    },
    {
      toVersion: 7,
      steps: [
        // Records which index definitions the current rows were built from, so
        // an interrupted rebuild is detected on the next launch instead of
        // looking complete forever. Left NULL for existing installs, which
        // forces exactly one rebuild after upgrading.
        unsafeExecuteSql(`
          ALTER TABLE observation_index_meta ADD COLUMN defs_signature TEXT;
        `),
      ],
    },
  ],
});

/** Retain each adapter for the lifetime of this JS runtime. Never reopen a visited name. */
export let database: Database;
const instances = new Map<string, Database>();
const initializations = new Map<string, Promise<void>>();

export function getDatabase(): Database {
  if (!database || instances.get(getActiveProfile().id) !== database) {
    throw new Error(
      'Profile database is not initialized. Await initializeProfileDatabase() before loading App.',
    );
  }
  profileActivity.assertAvailable();
  return database;
}

/** Opens a profile once; revisiting it selects its retained Database. */
export function initializeProfileDatabase(
  duringTransition = false,
): Promise<void> {
  assertProfileReady();
  const { id, dbName } = getActiveProfile();
  const existing = initializations.get(id);
  if (existing) {
    const retained = instances.get(id);
    if (retained) database = retained;
    return existing;
  }
  const open = async () => {
    const selected = instances.get(id);
    if (selected) {
      database = selected;
      return;
    }
    // Preparation is idempotent per name. A failed open must not be retried
    // in this runtime: it may have left an adapter with native handles.
    await prepareProfileDatabase(dbName);
    installWatermelonLogBridge();
    const adapter = new SQLiteAdapter({
      schema: schemas,
      dbName,
      migrations,
      jsi: true,
      onSetUpError: error => {
        logger.error(
          'db',
          error instanceof Error ? error.message : 'Database setup error',
        );
      },
    });
    await adapter.initializingPromise;
    const candidate = new Database({
      adapter,
      modelClasses: [ObservationModel],
    });
    // Validate that the observation table is usable without scanning its rows.
    await candidate.read(() =>
      candidate
        .get('observations')
        .query(Q.unsafeSqlQuery('SELECT id FROM observations LIMIT 1'))
        .unsafeFetchRaw(),
    );
    await logSqliteEngine(candidate).catch(error => {
      logger.warn(
        'db',
        error instanceof Error ? error.message : 'sqlite engine probe failed',
      );
    });
    instances.set(id, candidate);
    database = candidate;
  };
  const initialization = duringTransition
    ? open()
    : profileActivity.run('Initialize profile database', open);
  initializations.set(id, initialization);
  return initialization;
}
