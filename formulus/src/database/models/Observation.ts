/**
 * Interface for the observation data structure
 *
 * @property {string} id The unique identifier for the observation
 * @property {string} formT ype The unique identifier for the form
 * @property {string} formVersion The version of the form
 * @property {any} data The form data
 * @property {Date} createdAt The date-time when the observation was created
 * @property {Date} updatedAt The date-time when the observation was last updated
 * @property {Date|null} syncedAt The date-time when the observation was last synced with the server
 */
export interface Observation {
  id: string;
  formType: string;
  formVersion: string;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date|null;
  deleted: boolean;
  data: any;
}
