import { appSchema, tableSchema } from '@nozbe/watermelondb';

// Define the database schema
export const schemas = appSchema({
  version: 6,
  tables: [
    tableSchema({
      name: 'observations',
      columns: [
        { name: 'observation_id', type: 'string', isIndexed: true },
        { name: 'form_type', type: 'string', isIndexed: true },
        { name: 'form_version', type: 'string' },
        { name: 'deleted', type: 'boolean', isIndexed: true },
        { name: 'data', type: 'string' },
        { name: 'geolocation', type: 'string' },
        { name: 'author', type: 'string' },
        { name: 'device_id', type: 'string' },
        { name: 'tags', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'synced_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'observation_index_meta',
      columns: [
        { name: 'active_generation', type: 'number' },
        { name: 'building_generation', type: 'number', isOptional: true },
        { name: 'last_rebuild_at', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'observation_index',
      columns: [
        { name: 'observation_id', type: 'string', isIndexed: true },
        { name: 'index_key', type: 'string', isIndexed: true },
        { name: 'index_generation', type: 'number', isIndexed: true },
        { name: 'value_text', type: 'string', isOptional: true },
        { name: 'value_num', type: 'number', isOptional: true },
      ],
    }),
  ],
});
