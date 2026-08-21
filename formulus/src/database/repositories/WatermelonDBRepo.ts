import {
  compileObservationQuery,
  indexKeysFromConfig,
  type ObservationFilter,
} from '@ode/observation-query';
import { Database, Q, Collection } from '@nozbe/watermelondb';
import ObservationIndexService from '../../services/ObservationIndexService';
import { ObservationModel } from '../models/ObservationModel';
import { LocalRepoInterface } from './LocalRepoInterface';
import {
  Observation,
  NewObservationInput,
  UpdateObservationInput,
} from '../models/Observation';
import { ObservationMapper } from '../../mappers/ObservationMapper';
import { geolocationService } from '../../services/GeolocationService';
import { ToastService } from '../../services/ToastService';
import { clientIdService } from '../../services/ClientIdService';
import { getUserInfo } from '../../api/synkronus/Auth';
import { LAST_WRITE_WON_TAG } from '../../sync/syncConstants';
import { logger } from '../../diagnostics/logger';
import {
  buildObservationListSql,
  mapObservationListRow,
  type ObservationListPage,
  type ObservationListQuery,
} from '../observationListQuery';

function parseTagsColumn(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((t): t is string => typeof t === 'string');
  } catch {
    return [];
  }
}

function serializeTagsColumn(tags: string[]): string {
  return tags.length > 0 ? JSON.stringify(tags) : '';
}

function toTimestampMs(
  value: Date | number | string | null | undefined,
): number | null {
  if (value == null || value === '') {
    return null;
  }
  const ms =
    value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Watermelon owns created_at / updated_at via @readonly @date and stamps "now"
 * on create/update. Pull must write the Synkronus envelope times through
 * _setRaw or the list shows the local insert (sync) time instead.
 */
function applyEnvelopeTimestamps(
  record: ObservationModel,
  change: Observation,
): void {
  const createdMs = toTimestampMs(change.createdAt);
  if (createdMs != null) {
    record._setRaw('created_at', createdMs);
  }
  const updatedMs = toTimestampMs(change.updatedAt);
  if (updatedMs != null) {
    record._setRaw('updated_at', updatedMs);
  }
}

/**
 * WatermelonDB implementation of the LocalRepoInterface
 * This implementation is designed to work well with the Synkronus API's pull/push synchronization
 */
export class WatermelonDBRepo implements LocalRepoInterface {
  private database: Database;
  private observationsCollection: Collection<ObservationModel>;
  private columnIndexesPromise: Promise<void> | null = null;

  constructor(database: Database) {
    this.database = database;
    this.observationsCollection =
      database.get<ObservationModel>('observations');
    // Touch the index service early so the `bundleUpdated` listener and the
    // initial-rebuild bootstrap kick off before any sync activity.
    ObservationIndexService.getInstance(this.database);
    void this.ensureColumnIndexes();
  }

  /**
   * Column indexes on `observations` (not the custom-app EAV table).
   * `form_type` is always required for list/query paths. CREATE INDEX IF NOT
   * EXISTS is a no-op when Watermelon already created them from the schema.
   */
  private ensureColumnIndexes(): Promise<void> {
    if (!this.columnIndexesPromise) {
      this.columnIndexesPromise = (async () => {
        try {
          await this.database.write(async () => {
            await this.database.adapter.unsafeExecute({
              sqls: [
                [
                  'CREATE INDEX IF NOT EXISTS observations_form_type ON observations(form_type)',
                  [],
                ],
                [
                  'CREATE INDEX IF NOT EXISTS observations_deleted ON observations(deleted)',
                  [],
                ],
                [
                  'CREATE INDEX IF NOT EXISTS observations_form_type_deleted ON observations(form_type, deleted)',
                  [],
                ],
              ],
            });
          });
          logger.info('db', 'observation column indexes ready', {
            phase: 'index',
            success: true,
          });
        } catch (err) {
          this.columnIndexesPromise = null;
          logger.warn(
            'db',
            err instanceof Error
              ? err.message
              : 'failed to ensure observation column indexes',
            { phase: 'index', success: false },
          );
        }
      })();
    }
    return this.columnIndexesPromise;
  }

  /**
   * Save a new observation with geolocation capture
   * @param input The observation data to be saved (formType and data)
   * @returns Promise resolving to the ID of the saved observation
   */
  async saveObservation(input: NewObservationInput): Promise<string> {
    try {
      logger.info('db', 'saving observation', { formType: input.formType });

      // Use pre-cached GPS when available, fall back to fresh capture
      let geolocation = null;
      try {
        geolocation = geolocationService.getCachedLocation();
        if (!geolocation) {
          geolocation =
            await geolocationService.getCurrentLocationForObservation();
        }
        if (geolocation) {
          ToastService.showGeolocationCaptured();
        } else {
          ToastService.showGeolocationUnavailable();
        }
      } catch (geoError) {
        console.warn('Failed to capture geolocation:', geoError);
        ToastService.showGeolocationUnavailable();
      }

      // Ensure data is properly stringified
      const stringifiedData =
        typeof input.data === 'string'
          ? input.data
          : JSON.stringify(input.data);

      // Capture author and device id
      let author: string = input.author ?? '';
      try {
        if (!author) {
          const user = await getUserInfo();
          author = user?.username ?? '';
        }
      } catch (error) {
        console.error('Error capturing author', error);
      }
      const deviceId: string =
        input.deviceId ?? (await clientIdService.getClientId());

      const stringifiedTags =
        input.tags != null && input.tags.length > 0
          ? JSON.stringify(input.tags)
          : '';

      // Stringify geolocation for storage
      const stringifiedGeolocation = geolocation
        ? JSON.stringify(geolocation)
        : '';

      // Generate a unique observation ID that will be used as the WatermelonDB record ID
      const observationId = `obs_${Date.now()}_${Math.floor(
        Math.random() * 10000,
      )}`;

      // Create the record with our observationId as the primary key
      let newRecord: ObservationModel | null = null;

      await this.database.write(async () => {
        newRecord = await this.observationsCollection.create(record => {
          // Use our observationId as the WatermelonDB record ID
          record._raw.id = observationId;
          // Also store it in the observationId field for consistency
          record.observationId = observationId;
          record.formType = input.formType;
          record.formVersion = input.formVersion || '1.0';
          record.data = stringifiedData;
          record.geolocation = stringifiedGeolocation;
          record.author = author;
          record.deviceId = deviceId;
          record.tags = stringifiedTags;
          record.deleted = false; // New observations are never deleted
          // Don't set syncedAt - let it be null so the observation is marked as pending sync
        });
      });

      if (!newRecord) {
        throw new Error('Failed to create observation record');
      }

      await ObservationIndexService.getInstance(
        this.database,
      ).incrementalReindex(observationId, input.formType, stringifiedData);

      // Return the observationId as the public identifier
      return observationId;
    } catch (error) {
      console.error(
        'Error saving observation:',
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /** Resolve a row by Watermelon id or by observation_id column (legacy ingested rows - TODO: Legacy support to be removed in vNextMinor). */
  private async findObservationRecord(
    stableId: string,
  ): Promise<ObservationModel | null> {
    try {
      return await this.observationsCollection.find(stableId);
    } catch {
      const rows = await this.observationsCollection
        .query(Q.where('observation_id', stableId))
        .fetch();
      return rows[0] ?? null;
    }
  }

  /**
   * Get an observation by its ID
   * @param id The unique identifier for the observation
   * @returns Promise resolving to the observation data or null if not found
   */
  async getObservation(id: string): Promise<Observation | null> {
    try {
      // First try direct lookup by ID (WatermelonDB's internal ID)
      try {
        const observation = await this.observationsCollection.find(id);
        return this.mapObservationModelToInterface(observation);
      } catch {
        // ID not found, continue to next approach
      }

      // If not found by ID, try to find by observationId field
      // Force a database sync before querying to ensure we have the latest data
      await this.database.get('observations').query().fetch();

      const observations = await this.observationsCollection
        .query(Q.where('observation_id', id))
        .fetch();

      if (observations.length > 0) {
        const observation = observations[0];
        return this.mapObservationModelToInterface(observation);
      }

      return null;
    } catch (error) {
      console.error(
        'Error getting observation:',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  /**
   * Get all observations for a specific form type
   * @param formId The unique identifier for the form type
   * @returns Promise resolving to an array of observations
   */
  async queryObservations(options: {
    formType: string;
    includeDeleted?: boolean;
    filter?: ObservationFilter;
  }): Promise<Observation[]> {
    try {
      await this.ensureColumnIndexes();
      const indexService = ObservationIndexService.getInstance(this.database);
      const ensureStarted = Date.now();
      await indexService.ensureInitialRebuild();
      logger.info(
        'observations',
        `queryObservations ensureInitialRebuild ${Date.now() - ensureStarted}ms`,
        { formType: options.formType, phase: 'ensure' },
      );

      let indexKeys = indexKeysFromConfig(indexService.getIndexDefs());
      if (indexKeys.size > 0 && !(await indexService.isIndexUsable())) {
        // ensureInitialRebuild() reports success even when it gave up, so this
        // is the last point at which an unusable index can be caught. Querying
        // an empty index returns no rows, and one built from a previous
        // bundle's definitions returns wrong ones — neither raises an error.
        console.warn(
          '[queryObservations] observation_index is empty or stale for the active generation; using json_extract so results stay correct',
        );
        indexKeys = new Set<string>();
      }
      const compiled = compileObservationQuery({
        dialect: 'formulus',
        jsonColumn: 'data',
        tableAlias: 'observations',
        observationsTable: 'observations',
        formType: options.formType,
        includeDeleted: options.includeDeleted,
        filter: options.filter,
        indexKeys,
      });
      if ('code' in compiled) {
        throw new Error(`${compiled.code}: ${compiled.message}`);
      }
      if (compiled.warnings.length) {
        console.warn('[queryObservations]', compiled.warnings.join('; '));
      }
      const rows = await this.observationsCollection
        .query(Q.unsafeSqlQuery(compiled.sql, compiled.params))
        .unsafeFetchRaw();
      return rows.map(raw => this.mapRawObservationRow(raw));
    } catch (error) {
      console.error(
        'Error querying observations:',
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async getObservationsByFormType(formId: string): Promise<Observation[]> {
    try {
      // Validate formId parameter
      if (!formId || typeof formId !== 'string' || formId.trim() === '') {
        console.warn(
          'Invalid formId provided to getObservationsByFormType:',
          formId,
        );
        return [];
      }

      await this.ensureColumnIndexes();
      logger.info('observations', 'getByFormType query start', {
        formType: formId,
        phase: 'query',
      });
      const queryStarted = Date.now();
      const rows = await this.observationsCollection
        .query(Q.where('form_type', formId), Q.where('deleted', false))
        .unsafeFetchRaw();
      const fetchedMs = Date.now() - queryStarted;
      const mapped = rows.map(raw => this.mapRawObservationRow(raw));
      logger.info(
        'observations',
        `getByFormType fetch=${fetchedMs}ms map=${Date.now() - queryStarted - fetchedMs}ms`,
        {
          formType: formId,
          phase: 'query',
          counts: mapped.length,
        },
      );
      return mapped;
    } catch (error) {
      console.error(
        'Error getting observations by form type ID:',
        error instanceof Error ? error.message : String(error),
      );
      return [];
    }
  }

  async getActiveObservations(): Promise<Observation[]> {
    await this.ensureColumnIndexes();
    logger.info('observations', 'getActive query start', { phase: 'query' });
    const queryStarted = Date.now();
    const rows = await this.observationsCollection
      .query(Q.where('deleted', false))
      .unsafeFetchRaw();
    const fetchedMs = Date.now() - queryStarted;
    const mapped = rows.map(raw => this.mapRawObservationRow(raw));
    logger.info(
      'observations',
      `getActive fetch=${fetchedMs}ms map=${Date.now() - queryStarted - fetchedMs}ms`,
      { phase: 'query', counts: mapped.length },
    );
    return mapped;
  }

  async listObservationsPage(
    query: ObservationListQuery,
  ): Promise<ObservationListPage> {
    await this.ensureColumnIndexes();
    const built = buildObservationListSql(query);
    const started = Date.now();
    const [rawRows, countRows] = await Promise.all([
      this.observationsCollection
        .query(Q.unsafeSqlQuery(built.listSql, built.listParams))
        .unsafeFetchRaw(),
      this.observationsCollection
        .query(Q.unsafeSqlQuery(built.countSql, built.countParams))
        .unsafeFetchRaw(),
    ]);
    const total = Number(
      (countRows[0] as { cnt?: number } | undefined)?.cnt ?? 0,
    );
    const rows = rawRows.map(row => mapObservationListRow(row));
    const totalPages = Math.max(1, Math.ceil(total / built.pageSize));
    logger.info('observations', `listPage fetch=${Date.now() - started}ms`, {
      phase: 'query',
      counts: rows.length,
      formType: query.formType ?? undefined,
    });
    return {
      rows,
      total,
      page: built.page,
      pageSize: built.pageSize,
      totalPages,
    };
  }

  /**
   * All local observation rows (including soft-deleted), for backup/export.
   */
  async getAllObservations(): Promise<Observation[]> {
    try {
      const rows = await this.observationsCollection.query().fetch();
      return rows.map(row => this.mapObservationModelToInterface(row));
    } catch (error) {
      console.error(
        'Error getting all observations:',
        error instanceof Error ? error.message : String(error),
      );
      return [];
    }
  }

  /**
   * Update an existing observation
   * @param input The observation ID and new data
   * @returns Promise resolving to a boolean indicating success
   */
  async updateObservation(input: UpdateObservationInput): Promise<boolean> {
    try {
      const record = await this.findObservationRecord(input.observationId);

      if (!record) {
        console.error('Observation not found with ID:', input.observationId);
        return false;
      }

      // Update the record
      let success = false;
      await this.database.write(async () => {
        await record!.update(rec => {
          // Handle data update - this is the main field we update
          const stringifiedData =
            typeof input.data === 'string'
              ? input.data
              : JSON.stringify(input.data);
          rec.data = stringifiedData;

          // Update the updatedAt timestamp (handled automatically by WatermelonDB)
          // Note: We don't update formType, formVersion, deleted, or syncedAt
          // as these are metadata fields not included in UpdateObservationInput
        });
        success = true;
      });

      if (success) {
        const stringifiedData =
          typeof input.data === 'string'
            ? input.data
            : JSON.stringify(input.data);
        await ObservationIndexService.getInstance(
          this.database,
        ).incrementalReindex(record.id, record.formType, stringifiedData);
        await this.database.get('observations').query().fetch();
      }

      return success;
    } catch (error) {
      console.error(
        'Error updating observation:',
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Delete an observation (mark as deleted)
   * @param id The unique identifier for the observation
   * @returns Promise resolving to a boolean indicating success
   */
  async deleteObservation(id: string): Promise<boolean> {
    try {
      const record = await this.findObservationRecord(id);

      if (!record) {
        console.error('Observation not found with ID:', id);
        return false;
      }

      // Mark the record as deleted (soft delete)
      let success = false;
      await this.database.write(async () => {
        await record!.update(rec => {
          rec.deleted = true;
        });
        success = true;
      });

      // Verify the update
      if (success) {
        // Force a database sync
        await this.database.get('observations').query().fetch();
      }

      return success;
    } catch (error) {
      console.error(
        'Error marking observation as deleted:',
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Mark an observation as synced with the server
   * @param id The unique identifier for the observation
   * @returns Promise resolving to a boolean indicating success
   */
  async markObservationAsSynced(id: string): Promise<boolean> {
    try {
      // Find the observation using our improved lookup approach
      let record: ObservationModel | null = null;

      // Try to find by direct ID first
      try {
        record = await this.observationsCollection.find(id);
      } catch {
        // not found by primary key
      }

      // If not found by ID, try to find by observationId field
      if (!record) {
        const observations = await this.observationsCollection
          .query(Q.where('observation_id', id))
          .fetch();

        if (observations.length > 0) {
          record = observations[0];
        }
      }

      if (!record) {
        console.error('Observation not found with ID:', id);
        return false;
      }

      // Update the syncedAt timestamp
      let success = false;
      await this.database.write(async () => {
        await record!.update(rec => {
          rec.syncedAt = new Date();
        });
        success = true;
      });

      // Verify the update
      if (success) {
        // Force a database sync
        await this.database.get('observations').query().fetch();
      }

      return success;
    } catch (error) {
      console.error(
        'Error marking observation as synced:',
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Apply changes from the server to the local database
   * @param changes Array of changes to apply
   */
  async applyServerChanges(
    changes: Observation[],
    options?: {
      onIndexProgress?: (progress: { current: number; total: number }) => void;
      isCancelled?: () => boolean;
    },
  ): Promise<number> {
    if (!changes.length) {
      return 0;
    }

    // Only the changes whose data actually landed in the database may be
    // indexed. A locally dirty record keeps its local data and is merely tagged,
    // so indexing the server payload for it would leave the index describing
    // values the stored record does not have — invisible until a full rebuild.
    const applied: Observation[] = [];
    const writeStarted = Date.now();

    const count = await this.database.write(async () => {
      const existingRecords = await this.observationsCollection
        .query(
          Q.where('observation_id', Q.oneOf(changes.map(c => c.observationId))),
        )
        .fetch();
      const existingMap = new Map(
        existingRecords.map(record => [record.observationId, record]),
      );
      const batchOps = changes
        .map(change => {
          const existing = existingMap.get(change.observationId);
          if (existing) {
            if (existing.updatedAt > existing.syncedAt) {
              const currentTags = parseTagsColumn(existing.tags);
              if (currentTags.includes(LAST_WRITE_WON_TAG)) {
                return null;
              }
              const merged = [...currentTags, LAST_WRITE_WON_TAG];
              return existing.prepareUpdate(record => {
                record.tags = serializeTagsColumn(merged);
              });
            }
            applied.push(change);
            return existing.prepareUpdate(record => {
              record.formType = change.formType || record.formType;
              record.formVersion = change.formVersion || record.formVersion;
              record.data =
                typeof change.data === 'string'
                  ? change.data
                  : JSON.stringify(change.data);
              record.deleted = change.deleted ?? record.deleted;
              // Set optional metadata if provided
              if (change.author !== undefined) {
                record.author = change.author ?? '';
              }
              if (change.deviceId !== undefined) {
                record.deviceId = change.deviceId ?? '';
              }
              if (change.tags !== undefined) {
                record.tags =
                  change.tags != null && change.tags.length > 0
                    ? JSON.stringify(change.tags)
                    : '';
              }
              record.syncedAt = new Date();
              applyEnvelopeTimestamps(record, change);
            });
          }
          applied.push(change);
          return this.observationsCollection.prepareCreate(record => {
            record._raw.id = change.observationId;
            record.observationId = change.observationId;
            record.formType = change.formType || '';
            record.formVersion = change.formVersion || '1.0';
            record.data =
              typeof change.data === 'string'
                ? change.data
                : JSON.stringify(change.data);
            record.author = change.author ?? '';
            record.deviceId = change.deviceId ?? '';
            record.tags =
              change.tags != null && change.tags.length > 0
                ? JSON.stringify(change.tags)
                : '';
            record.deleted = change.deleted ?? false;
            record.syncedAt = new Date();
            applyEnvelopeTimestamps(record, change);
          });
        })
        .filter((op): op is NonNullable<typeof op> => op != null);
      if (batchOps.length > 0) {
        await this.database.batch(...batchOps);
      }
      return batchOps.length;
    });
    const writeMs = Date.now() - writeStarted;

    if (options?.isCancelled?.()) {
      logger.info(
        'sync',
        `apply write=${writeMs}ms rows=${count} skipped index (cancelled)`,
        { phase: 'apply', counts: count },
      );
      throw new Error('Sync cancelled');
    }

    const indexService = ObservationIndexService.getInstance(this.database);
    const indexRows = applied.map(change => ({
      observationId: change.observationId,
      formType: change.formType,
      dataJson: change.data,
    }));
    const indexStarted = Date.now();
    await indexService.incrementalReindexMany(
      indexRows,
      options?.onIndexProgress,
      options?.isCancelled,
    );
    logger.info(
      'sync',
      `apply write=${writeMs}ms index=${Date.now() - indexStarted}ms rows=${count}`,
      { phase: 'apply', counts: count },
    );

    return count;
  }

  /**
   * Get pending changes from the local database (unsynced or updated after last sync).
   * Includes new, updated, and soft-deleted records so sync can push them to the server.
   * synced_at can be null or 0 when never synced depending on storage.
   */
  getPendingChanges(): Promise<Observation[]> {
    return this.observationsCollection
      .query(
        Q.or(
          Q.where('synced_at', Q.eq(null)),
          Q.where('synced_at', 0),
          Q.where('updated_at', Q.gt(Q.column('synced_at'))),
        ),
      )
      .fetch()
      .then(records =>
        records.map(record => ObservationMapper.fromDBModel(record)),
      );
  }

  /**
   * Mark observations as synced with the server
   * @param ids The unique identifiers for the observations
   */
  async markObservationsAsSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const now = new Date();
    await this.database.write(async () => {
      const byPk = await this.observationsCollection
        .query(Q.where('id', Q.oneOf(ids)))
        .fetch();
      const byObservationColumn = await this.observationsCollection
        .query(Q.where('observation_id', Q.oneOf(ids)))
        .fetch();
      const merged = new Map<string, ObservationModel>();
      for (const r of [...byPk, ...byObservationColumn]) {
        merged.set(r.id, r);
      }
      const records = [...merged.values()];

      const batchOps = records.map(record =>
        record.prepareUpdate(rec => {
          rec.syncedAt = rec.updatedAt > now ? rec.updatedAt : now;
        }),
      );

      if (batchOps.length > 0) {
        await this.database.batch(...batchOps);
      }
    });
  }

  /**
   * TODO: This method is currently not used - instead use applyServerChanges..
   * Synchronize observations with the server
   * @param pullChanges Function to pull changes from the server
   * @param pushChanges Function to push local changes to the server
   */
  async synchronize(
    pullChanges: () => Promise<Observation[]>,
    pushChanges: (observations: Observation[]) => Promise<void>,
  ): Promise<void> {
    try {
      // Step 1: Pull changes from the server
      const serverChanges = await pullChanges();

      // Step 2: Apply server changes to local database
      await this.applyServerChanges(serverChanges);

      // Step 3: Get local changes to push to server
      // Get all observations that haven't been synced or were updated after last sync
      const localChanges = await this.observationsCollection
        .query(
          Q.or(
            Q.where('synced_at', Q.eq(null)),
            Q.where('updated_at', Q.gt(Q.column('synced_at'))),
          ),
        )
        .fetch();

      // Step 4: Push local changes to server
      if (localChanges.length > 0) {
        // Convert WatermelonDB records to plain objects for the API
        const localObservations = localChanges.map(record =>
          this.mapObservationModelToInterface(record),
        );

        // Push changes to server
        await pushChanges(localObservations);

        // Mark all pushed observations as synced
        await this.database.write(async () => {
          for (const record of localChanges) {
            await record.update(rec => {
              rec.syncedAt = new Date();
            });
          }
        });
      }
    } catch (error) {
      console.error(
        'Error during synchronization:',
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  // Helper method to map WatermelonDB model to our interface
  private mapObservationModelToInterface(model: ObservationModel): Observation {
    return this.mapRawObservationRow(model._raw as Record<string, unknown>);
  }

  private mapRawObservationRow(row: Record<string, unknown>): Observation {
    const id = String(row.id ?? '');
    const observationId = String(row.observation_id ?? id);
    let parsedData: Record<string, unknown> = {};
    try {
      parsedData = JSON.parse(String(row.data ?? '{}')) as Record<
        string,
        unknown
      >;
    } catch {
      parsedData = {};
    }
    let geolocation = null;
    const geoRaw = row.geolocation;
    if (typeof geoRaw === 'string' && geoRaw.trim()) {
      try {
        geolocation = JSON.parse(geoRaw);
      } catch {
        geolocation = null;
      }
    }
    let tags: string[] | null = null;
    const tagsRaw = row.tags;
    if (typeof tagsRaw === 'string' && tagsRaw.trim()) {
      try {
        const parsed = JSON.parse(tagsRaw) as unknown;
        if (Array.isArray(parsed)) {
          tags = parsed.filter((t): t is string => typeof t === 'string');
        }
      } catch {
        tags = null;
      }
    }
    return {
      observationId,
      formType: String(row.form_type ?? ''),
      formVersion: String(row.form_version ?? '1.0'),
      data: parsedData,
      createdAt: new Date(Number(row.created_at ?? 0)),
      updatedAt: new Date(Number(row.updated_at ?? 0)),
      syncedAt: row.synced_at ? new Date(Number(row.synced_at)) : null,
      deleted: Boolean(row.deleted),
      geolocation,
      author: row.author ? String(row.author) : null,
      deviceId: row.device_id ? String(row.device_id) : null,
      tags,
    };
  }
}
