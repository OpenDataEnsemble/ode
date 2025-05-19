/**
 * Interface for observation data structure
 */
export interface Observation {
  id: string;
  observationId: string;
  formType: string;
  formVersion: string;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date;
  deleted: boolean;
  data: any;
}

/**
 * Interface for local data repository operations
 * This allows us to abstract the storage implementation for testability
 */
export interface LocalRepoInterface {
  /**
   * Save a completed form observation
   * @param observation The observation data to be saved
   * @returns Promise resolving to the ID of the saved observation
   */
  saveObservation(observation: Partial<Observation>): Promise<string>;
  
  /**
   * Get an observation by its ID
   * @param id The unique identifier for the observation
   * @returns Promise resolving to the observation data or null if not found
   */
  getObservation(id: string): Promise<Observation | null>;
  
  /**
   * Get all observations for a specific form
   * @param formId The unique identifier for the form
   * @returns Promise resolving to an array of observations
   */
  getObservationsByFormId(formId: string): Promise<Observation[]>;
  
  /**
   * Update an existing observation
   * @param id The unique identifier for the observation
   * @param observation The updated observation data
   * @returns Promise resolving to a boolean indicating success
   */
  updateObservation(id: string, observation: Partial<Observation>): Promise<boolean>;
  
  /**
   * Delete an observation
   * @param id The unique identifier for the observation
   * @returns Promise resolving to a boolean indicating success
   */
  deleteObservation(id: string): Promise<boolean>;
  
  /**
   * Mark an observation as synced with the server
   * @param id The unique identifier for the observation
   * @returns Promise resolving to a boolean indicating success
   */
  markObservationAsSynced(id: string): Promise<boolean>;
  
  /**
   * Synchronize observations with the server
   * This method can be integrated with your Synkronus API's pull/push functionality
   * @param pullChanges Function to pull changes from the server
   * @param pushChanges Function to push local changes to the server
   */
  synchronize?(
    pullChanges: () => Promise<any[]>,
    pushChanges: (observations: Observation[]) => Promise<void>
  ): Promise<void>;
}
