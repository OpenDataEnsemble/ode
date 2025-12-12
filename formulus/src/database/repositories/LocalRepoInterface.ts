import {
  Observation,
  NewObservationInput,
  UpdateObservationInput,
  ObservationData,
} from '../models/Observation';
/**
 * Interface for local data repository operations
 * This allows us to abstract the storage implementation for testability
 */
export interface LocalRepoInterface {
  /**
   * Save a new observation
   * @param input The observation data to be saved (formType and data)
   * @returns Promise resolving to the ID of the saved observation
   */
  saveObservation(input: NewObservationInput): Promise<string>;

  /**
   * Get an observation by its ID
   * @param observationId The unique identifier for the observation
   * @returns Promise resolving to the observation data or null if not found
   */
  getObservation(observationId: string): Promise<Observation | null>;

  /**
   * Get all observations for a specific form
   * @param formType The unique identifier for the form
   * @returns Promise resolving to an array of observations
   */
  getObservationsByFormType(formType: string): Promise<Observation[]>;

  /**
   * Update an existing observation
   * @param input The observation ID and new data
   * @returns Promise resolving to a boolean indicating success
   */
  updateObservation(input: UpdateObservationInput): Promise<boolean>;

  /**
   * Delete an observation
   * @param observationId The unique identifier for the observation
   * @returns Promise resolving to a boolean indicating success
   */
  deleteObservation(observationId: string): Promise<boolean>;

  /**
   * Mark an observation as synced with the server
   * @param ids The unique identifiers for the observations
   * @returns Promise resolving to a boolean indicating success
   */
  markObservationsAsSynced(ids: string[]): Promise<void>;

  /**
   * Apply changes to the local database
   * @param changes Array of changes to apply
   * @returns Promise resolving to the number of changes applied
   */
  applyServerChanges(changes: Observation[]): Promise<number>;

  /**
   * Get pending changes from the local database
   * @returns Promise resolving to an array of pending changes
   */
  getPendingChanges(): Promise<Observation[]>;

  /**
   * @deprecated Use applyChanges  instead
   * Synchronize observations with the server
   * This method can be integrated with your Synkronus API's pull/push functionality
   * @param pullChanges Function to pull changes from the server
   * @param pushChanges Function to push local changes to the server
   */
  synchronize?(
    pullChanges: () => Promise<ObservationData[]>,
    pushChanges: (observations: Observation[]) => Promise<void>,
  ): Promise<void>;
}
