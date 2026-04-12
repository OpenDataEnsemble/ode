import { describe, expect, it, vi } from 'vitest';
import {
  createNewObservationSaveRequest,
  DEFAULT_OBSERVATION_FORM_TYPE,
  DEFAULT_OBSERVATION_FORM_VERSION,
} from './observation';

describe('createNewObservationSaveRequest', () => {
  it('uses a UUID for id and includes OpenAPI-required observation fields', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '550e8400-e29b-41d4-a716-446655440000',
    );
    const req = createNewObservationSaveRequest();
    expect(req.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(req.formType).toBe(DEFAULT_OBSERVATION_FORM_TYPE);
    expect(req.payload).toEqual({});
    expect(req.updatedAt).toBe(req.extras?.createdAt);
    expect(req.extras?.formVersion).toBe(DEFAULT_OBSERVATION_FORM_VERSION);
    expect(req.extras?.deleted).toBe(false);
    vi.restoreAllMocks();
  });
});
