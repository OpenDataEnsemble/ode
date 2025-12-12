import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import {schemas} from './schema';
import {ObservationModel} from './models/ObservationModel';
import {schemaMigrations} from '@nozbe/watermelondb/Schema/migrations';

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
          columns: [{name: 'form_type_id', type: 'string', isIndexed: true}],
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
          columns: [{name: 'geolocation', type: 'string'}],
        },
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
  // Optional synchronous mode for development
  jsi: true,
  // Optional onSetUpError callback
  onSetUpError: error => {
    console.error('Database setup error:', error);
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
