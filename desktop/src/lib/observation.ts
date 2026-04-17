import type { SaveObservationRequest } from '../types/domain';

/**
 * Synkronus `Observation` schema: `ODE/synkronus/openapi/synkronus.yaml` (components/schemas/Observation).
 * Required: observation_id, form_type, form_version, data, created_at, updated_at, deleted.
 * Optional: synced_at, geolocation, author, device_id, tags.
 */
export const DEFAULT_OBSERVATION_FORM_TYPE = 'unknown';

export const DEFAULT_OBSERVATION_FORM_VERSION = '1.0.0';

/** Shape of JSON persisted as `payload` — corresponds to Synkronus `Observation.data`. */
export type ObservationFormData = Record<string, unknown>;

export function createEmptyObservationFormData(): ObservationFormData {
  return {};
}

export function tagsToCommaSeparated(
  tags: string[] | null | undefined,
): string {
  return tags?.length ? tags.join(', ') : '';
}

export function parseTagsCommaSeparated(text: string): string[] | null {
  const parts = text
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}

/** Builds a `SaveObservationRequest` for a brand-new local observation (UUID id, OpenAPI-required fields). */
export function createNewObservationSaveRequest(): SaveObservationRequest {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    formType: DEFAULT_OBSERVATION_FORM_TYPE,
    payload: createEmptyObservationFormData(),
    updatedAt: now,
    extras: {
      formVersion: DEFAULT_OBSERVATION_FORM_VERSION,
      createdAt: now,
      deleted: false,
    },
  };
}
