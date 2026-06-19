/**
 * Device-local monotonic sequence counters for scoped auto-numbering.
 * Keys are fully qualified (including device prefix) before storage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { clientIdService } from './ClientIdService';

const STORAGE_PREFIX = '@ode_sequence:';

export type AllocateSequenceOptions = {
  startAt?: number;
  peek?: boolean;
};

export class SequenceCounterService {
  private static instance: SequenceCounterService;

  private constructor() {}

  public static getInstance(): SequenceCounterService {
    if (!SequenceCounterService.instance) {
      SequenceCounterService.instance = new SequenceCounterService();
    }
    return SequenceCounterService.instance;
  }

  /** Prefix app-authored scope suffix with stable device id. */
  public async buildFullScopeKey(appScopeKey: string): Promise<string> {
    const trimmed = appScopeKey.trim();
    if (!trimmed) {
      throw new Error('scopeKey is required');
    }
    const deviceId = await clientIdService.getClientId();
    return `device:${deviceId}:${trimmed}`;
  }

  public async allocate(
    appScopeKey: string,
    options: AllocateSequenceOptions = {},
  ): Promise<number> {
    const fullKey = await this.buildFullScopeKey(appScopeKey);
    const startAt = options.startAt ?? 1;
    const storageKey = STORAGE_PREFIX + fullKey;

    const raw = await AsyncStorage.getItem(storageKey);
    const current = raw != null ? Number(raw) : startAt - 1;
    const last =
      Number.isFinite(current) && current >= startAt - 1 ? current : startAt - 1;
    const next = last + 1;

    if (!options.peek) {
      await AsyncStorage.setItem(storageKey, String(next));
    }

    return next;
  }
}

export const sequenceCounterService = SequenceCounterService.getInstance();
