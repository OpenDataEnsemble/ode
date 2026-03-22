// This class is used to map between the different observation types
// Current Observation Types
// 1: API Observation (generated/api.ts):
//  - Auto-generated from OpenAPI spec
//  - Represents the exact server-side data structure
//  - Used for API communication
// 2: Domain Observation (models/Observation.ts):
//  - Your application's domain model
//  - Should be the source of truth for your business logic
//  - Should not be tied to API or database concerns
// 3: Database Observation (repositories/WatermelonDBRepo.ts):
//  - Represents how data is stored in WatermelonDB
//  - Handles database-specific concerns (like relationships, indexing)

import { Observation as ApiObservation } from '../api/synkronus/generated';
import { Observation as DomainObservation } from '../database/models/Observation';
import { ObservationModel } from '../database/models/ObservationModel';
import { ObservationGeolocation } from '../types/Geolocation';

export class ObservationMapper {
  // API -> Domain
  static fromApi(apiObs: ApiObservation): DomainObservation {
    return {
      observationId: apiObs.observation_id,
      formType: apiObs.form_type,
      formVersion: apiObs.form_version,
      data: apiObs.data,
      createdAt: new Date(apiObs.created_at),
      updatedAt: new Date(apiObs.updated_at),
      syncedAt: apiObs.synced_at ? new Date(apiObs.synced_at) : null,
      deleted: apiObs.deleted || false,
      geolocation: apiObs.geolocation || null,
      author: apiObs.author ?? undefined,
      deviceId: apiObs.device_id ?? undefined,
      tags:
        apiObs.tags != null && apiObs.tags.length > 0
          ? [...apiObs.tags]
          : undefined,
    };
  }

  // Domain -> API
  static toApi(domainObs: DomainObservation): ApiObservation {
    const payload: ApiObservation = {
      observation_id: domainObs.observationId,
      form_type: domainObs.formType,
      form_version: domainObs.formVersion,
      data: domainObs.data,
      created_at: domainObs.createdAt.toISOString(),
      updated_at: domainObs.updatedAt.toISOString(),
      synced_at: domainObs.syncedAt?.toISOString() ?? null,
      deleted: domainObs.deleted,
      geolocation: domainObs.geolocation ?? null,
    };
    const author = domainObs.author?.trim();
    if (author) {
      payload.author = author;
    }
    const deviceId = domainObs.deviceId?.trim();
    if (deviceId) {
      payload.device_id = deviceId;
    }
    if (domainObs.tags != null && domainObs.tags.length > 0) {
      payload.tags = [...domainObs.tags];
    }
    return payload;
  }

  // Domain -> DB Model
  static toDBModel(domainObs: DomainObservation): Partial<ObservationModel> {
    return {
      id: domainObs.observationId,
      formType: domainObs.formType,
      formVersion: domainObs.formVersion,
      data:
        typeof domainObs.data === 'string'
          ? domainObs.data
          : JSON.stringify(domainObs.data),
      geolocation: domainObs.geolocation
        ? JSON.stringify(domainObs.geolocation)
        : '',
      deleted: domainObs.deleted,
      createdAt: domainObs.createdAt,
      updatedAt: domainObs.updatedAt,
      syncedAt: domainObs.syncedAt || undefined,
      author: domainObs.author ?? '',
      deviceId: domainObs.deviceId ?? '',
      tags: domainObs.tags?.length ? JSON.stringify(domainObs.tags) : '',
    };
  }

  /**
   * Canonical observation id for API/sync: the `observation_id` column (server id).
   * Falls back to Watermelon row id for empty legacy rows.
   */
  static observationIdFromDBModel(model: ObservationModel): string {
    const col = model.observationId?.trim();
    return col || model.id;
  }

  // DB Model -> Domain
  static fromDBModel(model: ObservationModel): DomainObservation {
    let geolocation: ObservationGeolocation | null = null;
    if (model.geolocation && model.geolocation.trim()) {
      try {
        geolocation = JSON.parse(model.geolocation);
      } catch (error) {
        console.warn('Failed to parse geolocation data:', error);
      }
    }

    let tags: string[] | undefined;
    if (model.tags && model.tags.trim()) {
      try {
        const parsed = JSON.parse(model.tags) as unknown;
        if (Array.isArray(parsed)) {
          tags = parsed.filter((t): t is string => typeof t === 'string');
        }
      } catch (error) {
        console.warn('Failed to parse tags:', error);
      }
    }

    return {
      observationId: ObservationMapper.observationIdFromDBModel(model),
      formType: model.formType,
      formVersion: model.formVersion,
      data:
        typeof model.data === 'string' ? JSON.parse(model.data) : model.data,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      syncedAt: model.syncedAt,
      deleted: model.deleted,
      geolocation,
      author: model.author?.trim() ? model.author : undefined,
      deviceId: model.deviceId?.trim() ? model.deviceId : undefined,
      tags,
    };
  }
}
