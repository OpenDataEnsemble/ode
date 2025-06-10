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
