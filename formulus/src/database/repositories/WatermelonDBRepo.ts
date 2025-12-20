import {Database, Q, Collection} from '@nozbe/watermelondb';
import {ObservationModel} from '../models/ObservationModel';
import {LocalRepoInterface} from './LocalRepoInterface';
import {
  Observation,
  NewObservationInput,
  UpdateObservationInput,
} from '../models/Observation';
import {ObservationMapper} from '../../mappers/ObservationMapper';
import {geolocationService} from '../../services/GeolocationService';
import {ToastService} from '../../services/ToastService';

/**
 * WatermelonDB implementation of the LocalRepoInterface
 * This implementation is designed to work well with the Synkronus API's pull/push synchronization
 */
export class WatermelonDBRepo implements LocalRepoInterface {
  private database: Database;
  private observationsCollection: Collection<ObservationModel>;

  constructor(database: Database) {
    this.database = database;
    this.observationsCollection =
      database.get<ObservationModel>('observations');
  }

  /**
   * Save a new observation with geolocation capture
   * @param input The observation data to be saved (formType and data)
   * @returns Promise resolving to the ID of the saved observation
   */
  async saveObservation(input: NewObservationInput): Promise<string> {
    try {
      console.log('Saving observation:', input);

      // Attempt to capture geolocation (non-blocking)
      let geolocation = null;
      try {
        geolocation =
          await geolocationService.getCurrentLocationForObservation();
        if (geolocation) {
          console.debug('Captured geolocation for observation');
          ToastService.showGeolocationCaptured();
        } else {
          console.debug('No geolocation available for observation');
          ToastService.showGeolocationUnavailable();
        }
      } catch (geoError) {
        console.warn(
          'Failed to capture geolocation for observation:',
          geoError,
        );
        ToastService.showGeolocationUnavailable();
      }

      // Ensure data is properly stringified
      const stringifiedData =
        typeof input.data === 'string'
          ? input.data
          : JSON.stringify(input.data);

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
          record.deleted = false; // New observations are never deleted
          // Don't set syncedAt - let it be null so the observation is marked as pending sync
        });
      });

      if (!newRecord) {
        throw new Error('Failed to create observation record');
      }

      console.log('Successfully created observation with ID:', observationId);

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

  /**
   * Get an observation by its ID
   * @param id The unique identifier for the observation
   * @returns Promise resolving to the observation data or null if not found
   */
  async getObservation(id: string): Promise<Observation | null> {
    try {
      console.log(`Looking up observation with ID: ${id}`);

      // First try direct lookup by ID (WatermelonDB's internal ID)
      try {
        const observation = await this.observationsCollection.find(id);
        console.log(`Found observation directly by ID: ${observation.id}`);
        return this.mapObservationModelToInterface(observation);
      } catch (error) {
        // ID not found, continue to next approach
        console.log(
          `Direct lookup by ID failed, trying by observationId: ${
            (error as Error).message
          }`,
        );
      }

      // If not found by ID, try to find by observationId field
      // Force a database sync before querying to ensure we have the latest data
      await this.database.get('observations').query().fetch();

      const observations = await this.observationsCollection
        .query(Q.where('observation_id', id))
        .fetch();

      console.log(
        `Query for observation_id=${id} returned ${observations.length} results`,
      );

      if (observations.length > 0) {
        const observation = observations[0];
        console.log(
          `Found observation via observationId query: ${observation.id}`,
        );
        return this.mapObservationModelToInterface(observation);
      }

      // Not found by either method
      // As a last resort, try to fetch all observations to see what's in the database
      const allObservations = await this.observationsCollection.query().fetch();
      console.log(
        `No observation found with ID: ${id}. Total observations in database: ${allObservations.length}`,
      );

      if (allObservations.length > 0) {
        console.log(
          'Available observations:',
          allObservations.map(o => ({
            id: o.id,
            observationId: o.observationId,
            formType: o.formType,
          })),
        );
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
  async getObservationsByFormType(formId: string): Promise<Observation[]> {
    try {
      console.log('Fetching observations for form type ID:', formId);

      // First, let's check all observations in the database for debugging
      const allObservations = await this.observationsCollection.query().fetch();
      console.log(`Total observations in database: ${allObservations.length}`);

      // Query for observations with form_type matching the requested form type
      const observations = await this.observationsCollection
        .query(Q.where('form_type', formId))
        .fetch();

      console.log(
        `Found ${observations.length} total observations for form type: ${formId}`,
      );

      return observations.map(observation =>
        this.mapObservationModelToInterface(observation),
      );
    } catch (error) {
      console.error(
        'Error getting observations by form type ID:',
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
      console.log(
        'Updating observation with ObservationId:',
        input.observationId,
      );

      // Find the observation by ID (which is now the observationId)
      const record = await this.observationsCollection.find(
        input.observationId,
      );

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

      // Verify the update
      if (success) {
        // Force a database sync
        await this.database.get('observations').query().fetch();

        // Verify the record was updated by querying for it again
        const updatedRecord = await this.observationsCollection.find(record.id);
        console.log('Successfully updated observation:', updatedRecord.id);
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
      console.log('Deleting observation with ObservationId:', id);

      // Find the observation by ID (which is now the observationId)
      const record = await this.observationsCollection.find(id);

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

        // Verify the record was updated by querying for it again
        const updatedRecord = await this.observationsCollection.find(record.id);
        console.log(
          'Successfully marked observation as deleted:',
          updatedRecord.id,
        );
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
      console.log(`Marking observation as synced: ${id}`);

      // Find the observation using our improved lookup approach
      let record: ObservationModel | null = null;

      // Try to find by direct ID first
      try {
        record = await this.observationsCollection.find(id);
      } catch (error) {
        console.log(
          `Direct lookup by ID failed, trying by observationId: ${
            (error as Error).message
          }`,
        );
      }

      // If not found by ID, try to find by observationId field
      if (!record) {
        const observations = await this.observationsCollection
          .query(Q.where('observation_id', id))
          .fetch();

        if (observations.length > 0) {
          record = observations[0];
          console.log(
            `Found observation via observationId query: ${record.id}`,
          );
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

        // Verify the record was updated by querying for it again
        const updatedRecord = await this.observationsCollection.find(record.id);
        console.log(
          'Successfully marked observation as synced:',
          updatedRecord.id,
        );
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
  async applyServerChanges(changes: Observation[]): Promise<number> {
    if (!changes.length) {
      return 0;
    }

    var count = await this.database.write(async () => {
      const existingRecords = await this.observationsCollection
        .query(
          Q.where('observation_id', Q.oneOf(changes.map(c => c.observationId))),
        )
        .fetch();
      const existingMap = new Map(
        existingRecords.map(record => [record.observationId, record]),
      );
      const batchOps = changes.map(change => {
        const existing = existingMap.get(change.observationId);
        if (existing) {
          console.debug(`Preparing update for observation: ${existing.id}`);
          if (existing.updatedAt > existing.syncedAt) {
            console.debug(
              `Skipping server change for ${existing.id} because it's locally dirty`,
            );
            return null; // skip applying server version (TODO: maybe include this information in the return value to be able to report it to the user)
          }
          return existing.prepareUpdate(record => {
            record.formType = change.formType || record.formType;
            record.formVersion = change.formVersion || record.formVersion;
            record.data =
              typeof change.data === 'string'
                ? change.data
                : JSON.stringify(change.data);
            record.deleted = change.deleted ?? record.deleted;
            record.syncedAt = new Date();
          });
        } else {
          console.debug(
            `Preparing create for new observation: ${change.observationId}`,
          );
          return this.observationsCollection.prepareCreate(record => {
            record.observationId = change.observationId;
            record.formType = change.formType || '';
            record.formVersion = change.formVersion || '1.0';
            record.data =
              typeof change.data === 'string'
                ? change.data
                : JSON.stringify(change.data);
            record.deleted = change.deleted ?? false;
            record.syncedAt = new Date();
          });
        }
      });
      await this.database.batch(...batchOps);
      return batchOps.length;
    });
    return count;
  }

  /**
   * Get pending changes from the local database
   * @returns Promise resolving to an array of pending changes
   */
  getPendingChanges(): Promise<Observation[]> {
    return this.observationsCollection
      .query(
        Q.or(
          Q.where('synced_at', Q.eq(null)),
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
    const now = new Date();
    await this.database.write(async () => {
      const records = await this.observationsCollection
        .query(Q.where('id', Q.oneOf(ids)))
        .fetch();

      const batchOps = records.map(record =>
        record.prepareUpdate(rec => {
          rec.syncedAt = rec.updatedAt > now ? rec.updatedAt : now;
        }),
      );

      await this.database.batch(...batchOps);
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
      console.log('Starting synchronization process');

      // Step 1: Pull changes from the server
      const serverChanges = await pullChanges();
      console.log(`Received ${serverChanges.length} changes from server`);

      // Step 2: Apply server changes to local database
      const pulledChanges = await this.applyServerChanges(serverChanges);
      console.log(`Applied ${pulledChanges} changes to local database`);

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

      console.log(`Found ${localChanges.length} local changes to push`);

      // Step 4: Push local changes to server
      if (localChanges.length > 0) {
        // Convert WatermelonDB records to plain objects for the API
        const localObservations = localChanges.map(record =>
          this.mapObservationModelToInterface(record),
        );

        // Push changes to server
        await pushChanges(localObservations);
        console.log(`Pushed ${localObservations.length} changes to server`);

        // Mark all pushed observations as synced
        await this.database.write(async () => {
          for (const record of localChanges) {
            await record.update(rec => {
              rec.syncedAt = new Date();
            });
          }
        });

        console.log('All pushed observations marked as synced');
      }

      console.log('Synchronization completed successfully');
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
    const parsedData = model.getParsedData();
    console.log(`Mapping model to interface. ID: ${model.id}`);

    // Parse geolocation data if available
    let geolocation = null;
    if (model.geolocation && model.geolocation.trim()) {
      try {
        geolocation = JSON.parse(model.geolocation);
      } catch (error) {
        console.warn('Failed to parse geolocation data:', error);
      }
    }

    return {
      observationId: model.id, // Now model.id is the same as observationId
      formType: model.formType,
      formVersion: model.formVersion,
      data: parsedData,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      syncedAt: model.syncedAt,
      deleted: model.deleted,
      geolocation,
    };
  }
}
