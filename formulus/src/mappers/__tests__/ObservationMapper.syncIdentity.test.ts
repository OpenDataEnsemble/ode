import { ObservationMapper } from '../ObservationMapper';
import type { ObservationModel } from '../../database/models/ObservationModel';

/**
 * Documents the contract broken when domain observationId is taken from WatermelonDB's
 * internal row id instead of the observation_id column (see WatermelonDBRepo.applyServerChanges prepareCreate).
 *
 * Why this was not caught earlier: WatermelonDBRepo tests only exercised saveObservation(),
 * which sets _raw.id === observation_id, so model.id and model.observationId were always equal.
 */
describe('ObservationMapper sync identity (regression)', () => {
  test('fromDBModel must use observation_id column when it differs from Watermelon row id', () => {
    const serverId = 'obs_pulled_from_sync_1001';
    const rowAsModel = {
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      observationId: serverId,
      formType: 'register_coffee',
      formVersion: '1.0',
      data: JSON.stringify({ k: 'v' }),
      geolocation: '',
      deleted: false,
      author: 'a',
      deviceId: 'd1',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-02T00:00:00.000Z'),
      syncedAt: new Date('2025-01-03T00:00:00.000Z'),
    } as ObservationModel;

    const domain = ObservationMapper.fromDBModel(rowAsModel);

    expect(domain.observationId).toBe(serverId);
    expect(domain.observationId).not.toBe(rowAsModel.id);

    const api = ObservationMapper.toApi(domain);
    expect(api.observation_id).toBe(serverId);
  });
});
