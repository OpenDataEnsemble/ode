import {appSchema, tableSchema} from '@nozbe/watermelondb';

// Define the database schema
export const schemas = appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'observations',
      columns: [
        {name: 'observation_id', type: 'string', isIndexed: true},
        {name: 'form_type', type: 'string', isIndexed: true},
        {name: 'form_version', type: 'string'},
        {name: 'deleted', type: 'boolean', isIndexed: true},
        {name: 'data', type: 'string'},
        {name: 'geolocation', type: 'string'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
        {name: 'synced_at', type: 'number'},
      ],
    }),
    // Add more tables as needed
  ],
});
