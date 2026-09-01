import { resolveSyncKnobs } from '../networkProfile';
import { getConnectivityMeterState } from '../connectivityMeter';

describe('getConnectivityMeterState', () => {
  it('shows Default before the adaptive knobs move', () => {
    expect(getConnectivityMeterState(resolveSyncKnobs())).toEqual({
      level: 2,
      labelKey: 'sync.connectivity.default',
    });
  });

  it('uses a speed label after either adaptive knob moves', () => {
    expect(getConnectivityMeterState(resolveSyncKnobs(57, 4))).toEqual({
      level: 1,
      labelKey: 'sync.connectivity.cautious',
    });
  });

  it('maps proven maximum throughput to Fast', () => {
    expect(getConnectivityMeterState(resolveSyncKnobs(500, 100))).toEqual({
      level: 5,
      labelKey: 'sync.connectivity.fast',
    });
  });
});
