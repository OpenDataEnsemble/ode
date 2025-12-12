import AsyncStorage from '@react-native-async-storage/async-storage';
import {Observation} from './models/Observation';
import {geolocationService} from '../services/GeolocationService';
import {ToastService} from '../services/ToastService';

/**
 * Repository interface for form observations
 */
export interface LocalRepoInterface {
  saveObservation(formType: string, data: any): Promise<string>;
  getObservation(observationId: string): Promise<Observation | null>;
  getObservationsByFormType(formType: string): Promise<Observation[]>;
  updateObservation(observationId: string, data: any): Promise<boolean>;
  deleteObservation(observationId: string): Promise<boolean>;
  markObservationAsSynced(observationId: string): Promise<boolean>;
}

/**
 * Implementation of the LocalRepoInterface using AsyncStorage
 * This provides a simpler implementation while we work on the WatermelonDB integration
 */
export class FormObservationRepository implements LocalRepoInterface {
  private readonly STORAGE_KEY_PREFIX = 'formulus:observation:';
  private readonly INDEX_KEY = 'formulus:observations:index';

  /**
   * Save a completed form observation with geolocation capture
   * @param formType The unique identifier for the form
   * @param data The form data to be saved
   * @returns Promise resolving to the ID of the saved observation
   */
  async saveObservation(formType: string, data: any): Promise<string> {
    try {
      // Generate a unique ID for the observation
      const id = `obs_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`;

      // Attempt to capture geolocation (non-blocking)
      let geolocation = null;
      try {
        geolocation =
          await geolocationService.getCurrentLocationForObservation();
        if (geolocation) {
          console.debug('Captured geolocation for observation:', id);
          ToastService.showGeolocationCaptured();
        } else {
          console.debug('No geolocation available for observation:', id);
          ToastService.showGeolocationUnavailable();
        }
      } catch (geoError) {
        console.warn(
          'Failed to capture geolocation for observation:',
          geoError,
        );
        ToastService.showGeolocationUnavailable();
      }

      // Create the observation object
      const observation: Observation = {
        observationId: id,
        formType,
        formVersion: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        syncedAt: null,
        deleted: false,
        data,
        geolocation,
      };

      // Save the observation to AsyncStorage
      await AsyncStorage.setItem(
        `${this.STORAGE_KEY_PREFIX}${id}`,
        JSON.stringify(observation),
      );

      // Update the index
      await this.addToIndex(id, formType);

      return id;
    } catch (error) {
      console.error('Error saving observation:', error);
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
      const data = await AsyncStorage.getItem(
        `${this.STORAGE_KEY_PREFIX}${id}`,
      );

      if (!data) {
        return null;
      }

      const observation = JSON.parse(data) as Observation;

      // Convert string dates back to Date objects
      observation.createdAt = new Date(observation.createdAt);
      observation.updatedAt = new Date(observation.updatedAt);

      return observation;
    } catch (error) {
      console.error('Error getting observation:', error);
      return null;
    }
  }

  /**
   * Get all observations for a specific form
   * @param formType The unique identifier for the form
   * @returns Promise resolving to an array of observations
   */
  async getObservationsByFormType(formType: string): Promise<Observation[]> {
    try {
      // Get the index
      const index = await this.getIndex();

      // Filter observations by formType
      const observationIds = Object.entries(index)
        .filter(([_, indexFormType]) => indexFormType === formType)
        .map(([id]) => id);

      // Get all observations
      const observations: Observation[] = [];

      for (const id of observationIds) {
        const observation = await this.getObservation(id);
        if (observation) {
          observations.push(observation);
        }
      }

      return observations;
    } catch (error) {
      console.error('Error getting observations by form ID:', error);
      return [];
    }
  }

  /**
   * Update an existing observation
   * @param id The unique identifier for the observation
   * @param data The updated form data
   * @returns Promise resolving to a boolean indicating success
   */
  async updateObservation(id: string, data: any): Promise<boolean> {
    try {
      // Get the existing observation
      const observation = await this.getObservation(id);

      if (!observation) {
        return false;
      }

      // Update the observation
      observation.data = data;
      observation.updatedAt = new Date();
      observation.syncedAt = null;

      // Save the updated observation
      await AsyncStorage.setItem(
        `${this.STORAGE_KEY_PREFIX}${id}`,
        JSON.stringify(observation),
      );

      return true;
    } catch (error) {
      console.error('Error updating observation:', error);
      return false;
    }
  }

  /**
   * Delete an observation
   * @param id The unique identifier for the observation
   * @returns Promise resolving to a boolean indicating success
   */
  async deleteObservation(id: string): Promise<boolean> {
    try {
      // Check if the observation exists
      const observation = await this.getObservation(id);

      if (!observation) {
        return false;
      }

      // Delete the observation
      await AsyncStorage.removeItem(`${this.STORAGE_KEY_PREFIX}${id}`);

      // Update the index
      await this.removeFromIndex(id);

      return true;
    } catch (error) {
      console.error('Error deleting observation:', error);
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
      // Get the existing observation
      const observation = await this.getObservation(id);

      if (!observation) {
        return false;
      }

      // Update the sync status
      observation.syncedAt = new Date();

      // Save the updated observation
      await AsyncStorage.setItem(
        `${this.STORAGE_KEY_PREFIX}${id}`,
        JSON.stringify(observation),
      );

      return true;
    } catch (error) {
      console.error('Error marking observation as synced:', error);
      return false;
    }
  }

  /**
   * Get the index of all observations
   * @returns Promise resolving to the index object
   */
  private async getIndex(): Promise<Record<string, string>> {
    try {
      const data = await AsyncStorage.getItem(this.INDEX_KEY);

      if (!data) {
        return {};
      }

      return JSON.parse(data) as Record<string, string>;
    } catch (error) {
      console.error('Error getting index:', error);
      return {};
    }
  }

  /**
   * Add an observation to the index
   * @param id The unique identifier for the observation
   * @param formId The form ID associated with the observation
   */
  private async addToIndex(id: string, formId: string): Promise<void> {
    try {
      // Get the existing index
      const index = await this.getIndex();

      // Add the observation to the index
      index[id] = formId;

      // Save the updated index
      await AsyncStorage.setItem(this.INDEX_KEY, JSON.stringify(index));
    } catch (error) {
      console.error('Error adding to index:', error);
    }
  }

  /**
   * Remove an observation from the index
   * @param id The unique identifier for the observation
   */
  private async removeFromIndex(id: string): Promise<void> {
    try {
      // Get the existing index
      const index = await this.getIndex();

      // Remove the observation from the index
      delete index[id];

      // Save the updated index
      await AsyncStorage.setItem(this.INDEX_KEY, JSON.stringify(index));
    } catch (error) {
      console.error('Error removing from index:', error);
    }
  }
}
