import {
  hasMeaningfulSyncedAt,
  isObservationFullySynced,
  MIN_VALID_SYNCED_AT_MS,
} from '../observationSyncStatus';

describe('observationSyncStatus', () => {
  const t0 = new Date('2025-06-01T12:00:00.000Z');
  const tLater = new Date('2025-06-02T12:00:00.000Z');

  test('hasMeaningfulSyncedAt rejects null and epoch', () => {
    expect(hasMeaningfulSyncedAt(null)).toBe(false);
    expect(hasMeaningfulSyncedAt(undefined)).toBe(false);
    expect(
      hasMeaningfulSyncedAt(new Date(MIN_VALID_SYNCED_AT_MS - 86400000)),
    ).toBe(false);
    expect(hasMeaningfulSyncedAt(t0)).toBe(true);
  });

  test('isObservationFullySynced matches updatedAt vs syncedAt', () => {
    expect(
      isObservationFullySynced({
        syncedAt: null,
        updatedAt: t0,
      }),
    ).toBe(false);

    expect(
      isObservationFullySynced({
        syncedAt: t0,
        updatedAt: t0,
      }),
    ).toBe(true);

    expect(
      isObservationFullySynced({
        syncedAt: t0,
        updatedAt: tLater,
      }),
    ).toBe(false);
  });
});
