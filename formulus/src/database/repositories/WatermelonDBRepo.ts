import { Database, Q, Collection } from '@nozbe/watermelondb';
import { ObservationModel } from '../models/ObservationModel';
import { LocalRepoInterface } from './LocalRepoInterface';
import { Observation, NewObservationInput, UpdateObservationInput } from '../models/Observation';
import { nullValue } from '@nozbe/watermelondb/RawRecord';

/**
 * WatermelonDB implementation of the LocalRepoInterface
 * This implementation is designed to work well with the Synkronus API's pull/push synchronization
 */
export class WatermelonDBRepo implements LocalRepoInterface {
  private database: Database;
  private observationsCollection: Collection<ObservationModel>;

  constructor(database: Database) {
    this.database = database;
    this.observationsCollection = database.get<ObservationModel>('observations');
  }

  /**
   * Save a new observation
   * @param input The observation data to be saved (formType and data)
   * @returns Promise resolving to the ID of the saved observation
   */
  async saveObservation(input: NewObservationInput): Promise<string> {
    try {
      console.log('Saving observation:', input);
      
      // Ensure data is properly stringified
      const stringifiedData = typeof input.data === 'string' 
        ? input.data 
        : JSON.stringify(input.data);
      
      // Generate a unique observation ID
      const observationId = `obs_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      
      // Simple, straightforward creation with a single transaction
      let newRecord: ObservationModel | null = null;
      
      await this.database.write(async () => {
        newRecord = await this.observationsCollection.create(record => {
          // Store our custom observationId for reference
          record.observationId = observationId;
          record.formType = input.formType;
          record.formVersion = input.formVersion || '1.0';
          record.data = stringifiedData;
          record.deleted = false; // New observations are never deleted
          record.syncedAt = new Date(); // Set initial sync time
        });
      });
      
      if (!newRecord) {
        throw new Error('Failed to create observation record');
      }
      
      console.log('Successfully created observation with ID:', (newRecord as ObservationModel).id, 'and observationId:', observationId);
      
      // Return the observationId as the public identifier
      return observationId;
    } catch (error) {
      const typedError = error as Error;
      console.error('Error saving observation:', typedError.message);
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
        console.log(`Direct lookup by ID failed, trying by observationId: ${(error as Error).message}`);
      }
      
      // If not found by ID, try to find by observationId field
      // Force a database sync before querying to ensure we have the latest data
      await this.database.get('observations').query().fetch();
      
      const observations = await this.observationsCollection
        .query(Q.where('observation_id', id))
        .fetch();
      
      console.log(`Query for observation_id=${id} returned ${observations.length} results`);
        
      if (observations.length > 0) {
        const observation = observations[0];
        console.log(`Found observation via observationId query: ${observation.id}`);
        return this.mapObservationModelToInterface(observation);
      }
      
      // Not found by either method
      // As a last resort, try to fetch all observations to see what's in the database
      const allObservations = await this.observationsCollection.query().fetch();
      console.log(`No observation found with ID: ${id}. Total observations in database: ${allObservations.length}`);
      
      if (allObservations.length > 0) {
        console.log('Available observations:', allObservations.map(o => ({ 
          id: o.id, 
          observationId: o.observationId,
          formType: o.formType
        })));
      }
      
      return null;
    } catch (error) {
      const typedError = error as Error;
      console.error('Error getting observation:', typedError.message);
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
        .query(
          Q.where('form_type', formId)
        )
        .fetch();
      
      console.log(`Found ${observations.length} total observations for form type: ${formId}`);
      
      return observations.map(observation => this.mapObservationModelToInterface(observation));
    } catch (error) {
      const typedError = error as Error;
      console.error('Error getting observations by form type ID:', typedError.message);
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
      console.log('Updating observation with ID:', input.id);
      
      // Find the observation to update
      let record: ObservationModel | null = null;
      
      // Try to find by direct ID first
      try {
        record = await this.observationsCollection.find(input.id);
      } catch (error) {
        console.log(`Direct lookup by ID failed, trying by observationId: ${(error as Error).message}`);
      }
      
      // If not found by ID, try to find by observationId field
      if (!record) {
        const observations = await this.observationsCollection
          .query(Q.where('observation_id', input.id))
          .fetch();
          
        if (observations.length > 0) {
          record = observations[0];
          console.log(`Found observation via observationId query: ${record.id}`);
        }
      }
      
      if (!record) {
        console.error('Observation not found with ID:', input.id);
        return false;
      }
      
      // Update the record
      let success = false;
      await this.database.write(async () => {
        await record!.update(rec => {
          // Handle data update - this is the main field we update
          const stringifiedData = typeof input.data === 'string' 
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
      const typedError = error as Error;
      console.error('Error updating observation:', typedError.message);
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
      console.log(`Marking observation as deleted: ${id}`);
      
      // Find the observation using our improved lookup approach
      let record: ObservationModel | null = null;
      
      // Try to find by direct ID first
      try {
        record = await this.observationsCollection.find(id);
      } catch (error) {
        console.log(`Direct lookup by ID failed, trying by observationId: ${(error as Error).message}`);
      }
      
      // If not found by ID, try to find by observationId field
      if (!record) {
        const observations = await this.observationsCollection
          .query(Q.where('observation_id', id))
          .fetch();
          
        if (observations.length > 0) {
          record = observations[0];
          console.log(`Found observation via observationId query: ${record.id}`);
        }
      }
      
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
        console.log('Successfully marked observation as deleted:', updatedRecord.id);
      }
      
      return success;
    } catch (error) {
      const typedError = error as Error;
      console.error('Error marking observation as deleted:', typedError.message);
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
        console.log(`Direct lookup by ID failed, trying by observationId: ${(error as Error).message}`);
      }
      
      // If not found by ID, try to find by observationId field
      if (!record) {
        const observations = await this.observationsCollection
          .query(Q.where('observation_id', id))
          .fetch();
          
        if (observations.length > 0) {
          record = observations[0];
          console.log(`Found observation via observationId query: ${record.id}`);
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
        console.log('Successfully marked observation as synced:', updatedRecord.id);
      }
      
      return success;
    } catch (error) {
      const typedError = error as Error;
      console.error('Error marking observation as synced:', typedError.message);
      return false;
    }
  }

  /**
   * Synchronize observations with the server
   * @param pullChanges Function to pull changes from the server
   * @param pushChanges Function to push local changes to the server
   */
  async synchronize(
    pullChanges: () => Promise<any[]>,
    pushChanges: (observations: Observation[]) => Promise<void>
  ): Promise<void> {
    try {
      console.log('Starting synchronization process');
      
      // Step 1: Pull changes from the server
      const serverChanges = await pullChanges();
      console.log(`Received ${serverChanges.length} changes from server`);
      
      // Step 2: Apply server changes to local database
      if (serverChanges.length > 0) {
        await this.database.write(async () => {
          for (const change of serverChanges) {
            try {
              // Check if the observation already exists
              const existingObservations = await this.observationsCollection
                .query(Q.where('observation_id', change.observationId))
                .fetch();
              
              if (existingObservations.length > 0) {
                // Update existing observation
                const existing = existingObservations[0];
                await existing.update(record => {
                  record.formType = change.formType || record.formType;
                  record.formVersion = change.formVersion || record.formVersion;
                  record.data = typeof change.data === 'string' ? change.data : JSON.stringify(change.data);
                  record.deleted = change.deleted || record.deleted;
                  record.syncedAt = new Date();
                });
                console.log(`Updated existing observation: ${existing.id}`);
              } else {
                // Create new observation
                await this.observationsCollection.create(record => {
                  record.observationId = change.observationId;
                  record.formType = change.formType || '';
                  record.formVersion = change.formVersion || '1.0';
                  record.data = typeof change.data === 'string' ? change.data : JSON.stringify(change.data);
                  record.deleted = change.deleted || false;
                  record.syncedAt = new Date();
                });
                console.log(`Created new observation from server: ${change.observationId}`);
              }
            } catch (error) {
              const typedError = error as Error;
              console.error(`Error processing server change for ${change.observationId}:`, typedError.message);
            }
          }
        });
      }
      
      // Step 3: Get local changes to push to server
      // Get all observations that haven't been synced or were updated after last sync
      const localChanges = await this.observationsCollection
        .query(
          Q.or(
            Q.where('synced_at', Q.eq(null)),
            Q.where('updated_at', Q.gt(Q.column('synced_at')))
          )
        )
        .fetch();
      
      console.log(`Found ${localChanges.length} local changes to push`);
      
      // Step 4: Push local changes to server
      if (localChanges.length > 0) {
        // Convert WatermelonDB records to plain objects for the API
        const localObservations = localChanges.map(record => this.mapObservationModelToInterface(record));
        
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
      const typedError = error as Error;
      console.error('Error during synchronization:', typedError.message);
      throw error;
    }
  }
  
  // Helper method to map WatermelonDB model to our interface
  private mapObservationModelToInterface(model: ObservationModel): Observation {
    const parsedData = model.getParsedData();
    console.log(`Mapping model to interface. ID: ${model.id}, ObservationID: ${model.observationId}`);
    
    return {
      id: model.observationId, // Use the custom observationId as the public ID
      formType: model.formType,
      formVersion: model.formVersion,
      data: parsedData,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      syncedAt: model.syncedAt,
      deleted: model.deleted
    };
  }
}
