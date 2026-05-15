jest.mock('../../database/database', () => ({
  database: {
    write: jest.fn(async (fn: () => Promise<void>) => fn()),
    adapter: { unsafeExecute: jest.fn(async () => undefined) },
    get: jest.fn(() => ({
      query: jest.fn(() => ({
        unsafeFetchRaw: jest.fn(async () => []),
      })),
    })),
  },
}));

jest.mock('../../webview/FormulusMessageHandlers', () => ({
  appEvents: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('../../services/AppConfigService', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => ({
      getConfig: jest.fn(() => ({
        observationIndexes: [
          { key: 'p_id', path: '$.p_id' },
          { key: '', path: '$.skip' },
          { key: 'hh_id', path: '' },
        ],
      })),
    })),
  },
}));

import ObservationIndexService from '../../services/ObservationIndexService';

const mockDb = {
  write: jest.fn(async (fn: () => Promise<void>) => fn()),
  adapter: {
    unsafeExecute: jest.fn(async () => undefined),
  },
  get: jest.fn(() => ({
    query: jest.fn(() => ({
      unsafeFetchRaw: jest.fn(async () => [
        { active_generation: 1, last_rebuild_at: null },
      ]),
    })),
  })),
};

describe('ObservationIndexService config', () => {
  test('getIndexDefs returns only entries with key and path', () => {
    const svc = ObservationIndexService.getInstance(mockDb as never);
    expect(svc.getIndexDefs()).toEqual([{ key: 'p_id', path: '$.p_id' }]);
  });

  test('getStatus reads meta row', async () => {
    const svc = ObservationIndexService.getInstance(mockDb as never);
    const status = await svc.getStatus();
    expect(status.activeGeneration).toBe(1);
  });
});
