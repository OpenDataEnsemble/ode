import { Database } from '@nozbe/watermelondb';
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

// Capture Watermelon's JSI-fallback warn before SQLiteAdapter runs initializeJSI.
installWatermelonLogBridge();

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

// Setup the adapter
const adapter = new SQLiteAdapter({
  schema: schemas,
  // Optional database name
  dbName: 'formulus',
  // Configure migrations
  migrations: migrations,
  // Requests the bundled JSI SQLite. Confirm with logSqliteEngine — Android
  // still falls back to system SQLite if WatermelonDBJSIPackage is missing.
  jsi: true,
  onSetUpError: error => {
    logger.error(
      'db',
      error instanceof Error ? error.message : 'Database setup error',
    );
  },
});

// Create the database
export const database = new Database({
  adapter,
  modelClasses: [
    ObservationModel,
    // Add more models as needed
  ],
});

void logSqliteEngine(database).catch(error => {
  logger.warn(
    'db',
    error instanceof Error ? error.message : 'sqlite engine probe failed',
  );
});
