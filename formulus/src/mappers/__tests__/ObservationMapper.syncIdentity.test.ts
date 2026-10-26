import { ObservationMapper } from '../ObservationMapper';
import type { ObservationModel } from '../../database/models/ObservationModel';

/**
 * Observations use the same stable identifier for both the WatermelonDB row id
 * and the observation_id column throughout persistence and synchronization.
 */
describe('ObservationMapper sync identity', () => {
  test('preserves the stable observation id from database to API', () => {
    const observationId = 'obs_pulled_from_sync_1001';
    const rowAsModel = {
      id: observationId,
      observationId,
      formType: 'register_coffee',
      formVersion: '1.0',
      data: JSON.stringify({ k: 'v' }),
      geolocation: '',
      deleted: false,
      author: 'a',
      deviceId: 'd1',
      tags: '',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-02T00:00:00.000Z'),
      syncedAt: new Date('2025-01-03T00:00:00.000Z'),
    } as ObservationModel;

    expect(rowAsModel.id).toBe(rowAsModel.observationId);

    const domain = ObservationMapper.fromDBModel(rowAsModel);
    expect(domain.observationId).toBe(observationId);

    const api = ObservationMapper.toApi(domain);
    expect(api.observation_id).toBe(observationId);
  });
});
