import type { FinalizeRequest } from './formPreviewBridge';
import type {
  ObservationRecord,
  SaveObservationRequest,
} from '../types/domain';

/** Host-only request construction; edits retain the stored envelope metadata. */
export function buildPreviewObservationSave(
  request: FinalizeRequest,
  existing?: ObservationRecord,
): SaveObservationRequest {
  if (request.kind === 'update' && !existing) {
    throw new Error('Existing observation is required for preview updates');
  }
  return {
    id: request.kind === 'update' ? request.observationId : crypto.randomUUID(),
    formType: request.formType,
    payload: request.finalData,
    extras:
      request.kind === 'update'
        ? existing!.extras
        : { formVersion: request.hostFormVersion ?? '1.0' },
  };
}
