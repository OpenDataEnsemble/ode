import {ObservationGeolocation} from '../../types/Geolocation';

/**
 * Interface for the observation data structure. This is
 *
 * @property {string} observationId The unique identifier for the observation
 * @property {string} formType The unique identifier for the form
 * @property {string} formVersion The version of the form
 * @property {ObservationData} data The form data
 * @property {Date} createdAt The date-time when the observation was created
 * @property {Date} updatedAt The date-time when the observation was last updated
 * @property {Date|null} syncedAt The date-time when the observation was last synced with the server
 * @property {ObservationGeolocation|null} geolocation Optional geolocation data captured when the observation was created
 */
export interface Observation {
  observationId: string;
  formType: string;
  formVersion: string;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date | null;
  deleted: boolean;
  data: ObservationData;
  geolocation: ObservationGeolocation | null;
}

/**
 * Type for the raw form data payload (what comes from the WebView)
 * This is the flexible JSON object containing the actual form field values
 */
export type ObservationData = Record<string, any>;

/**
 * Type for creating a new observation
 * Only requires formType and data - other fields are auto-generated
 */
export interface NewObservationInput {
  formType: string;
  data: ObservationData;
  formVersion?: string; // Optional, defaults to "1.0"
}

/**
 * Type for updating an existing observation
 * Only requires the new data - metadata is preserved/updated automatically
 */
export interface UpdateObservationInput {
  observationId: string;
  data: ObservationData;
}
