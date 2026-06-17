/// <reference types="jest" />

import { describe, it, expect } from '@jest/globals';
import { effectiveRepositoryGenerationForRequest } from '../repositoryGenerationRequest';

describe('effectiveRepositoryGenerationForRequest', () => {
  it('returns null when storage key is missing', () => {
    expect(effectiveRepositoryGenerationForRequest(null, null)).toBeNull();
  });

  it('returns null for invalid stored values', () => {
    expect(effectiveRepositoryGenerationForRequest('', null)).toBeNull();
    expect(effectiveRepositoryGenerationForRequest('x', null)).toBeNull();
    expect(effectiveRepositoryGenerationForRequest('0', null)).toBeNull();
  });

  it('treats default epoch 1 as omitted until an observation cursor exists', () => {
    expect(effectiveRepositoryGenerationForRequest('1', null)).toBeNull();
    expect(effectiveRepositoryGenerationForRequest('1', '')).toBeNull();
    expect(effectiveRepositoryGenerationForRequest('1', '0')).toBeNull();
    expect(effectiveRepositoryGenerationForRequest('1', ' 0 ')).toBeNull();
  });

  it('returns 1 once a real observation cursor is established', () => {
    expect(effectiveRepositoryGenerationForRequest('1', '42')).toBe(1);
  });

  it('returns stored epoch >1 even without last_seen (e.g. after recovery wipe)', () => {
    expect(effectiveRepositoryGenerationForRequest('5', null)).toBe(5);
    expect(effectiveRepositoryGenerationForRequest('5', '')).toBe(5);
  });
});
