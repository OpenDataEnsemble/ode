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

import {Observation as ApiObservation} from '../api/synkronus/generated';
import {Observation as DomainObservation} from '../database/models/Observation';
import {ObservationModel} from '../database/models/ObservationModel';
import {ObservationGeolocation} from '../types/Geolocation';

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
    };
  }

  // Domain -> API
  static toApi(domainObs: DomainObservation): ApiObservation {
    return {
      observation_id: domainObs.observationId,
      form_type: domainObs.formType,
      form_version: domainObs.formVersion,
      data: domainObs.data,
      created_at: domainObs.createdAt.toISOString(),
      updated_at: domainObs.updatedAt.toISOString(),
      synced_at: domainObs.syncedAt?.toISOString(),
      deleted: domainObs.deleted,
      geolocation: domainObs.geolocation,
    };
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
    };
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

    return {
      observationId: model.id,
      formType: model.formType,
      formVersion: model.formVersion,
      data:
        typeof model.data === 'string' ? JSON.parse(model.data) : model.data,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      syncedAt: model.syncedAt,
      deleted: model.deleted,
      geolocation,
    };
  }
}
