import { resolveSyncKnobs } from '../networkProfile';

describe('resolveSyncKnobs', () => {
  it('starts conservative with serial photo downloads', () => {
    expect(resolveSyncKnobs()).toEqual({
      pullPageSize: 32,
      pushBatchSize: 4,
      attachmentConcurrency: 1,
    });
  });

  it('clamps stored sizes into the legal bands', () => {
    expect(resolveSyncKnobs(900, 400)).toEqual({
      pullPageSize: 500,
      pushBatchSize: 100,
      attachmentConcurrency: 1,
    });
    expect(resolveSyncKnobs(10, 0)).toEqual({
      pullPageSize: 10,
      pushBatchSize: 1,
      attachmentConcurrency: 1,
    });
    expect(resolveSyncKnobs(120, 40)).toMatchObject({
      pullPageSize: 120,
      pushBatchSize: 40,
    });
  });
});
