import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PULL_PAGE_FLOOR,
  PUSH_BATCH_FLOOR,
  resolveSyncKnobs,
  type SyncKnobs,
} from '../sync/networkProfile';
import {
  nextAdaptivePullPageSize,
  nextAdaptivePushBatchSize,
  nextSizeAfterFailure,
} from '../sync/adaptivePageSize';

const ADAPTIVE_PULL_PAGE_KEY = '@ode/adaptivePullPageSize';
const ADAPTIVE_PUSH_BATCH_KEY = '@ode/adaptivePushBatchSize';

export class NetworkProfileService {
  private static instance: NetworkProfileService | null = null;

  private adaptivePullPageSize: number | undefined;
  private adaptivePushBatchSize: number | undefined;
  private loaded = false;

  static getInstance(): NetworkProfileService {
    if (!NetworkProfileService.instance) {
      NetworkProfileService.instance = new NetworkProfileService();
    }
    return NetworkProfileService.instance;
  }

  /** Test-only: drop singleton state. */
  static resetForTests(): void {
    NetworkProfileService.instance = null;
  }

  async load(): Promise<void> {
    if (this.loaded) {
      return;
    }
    try {
      const rawPull = await AsyncStorage.getItem(ADAPTIVE_PULL_PAGE_KEY);
      const parsedPull = rawPull != null ? Number(rawPull) : NaN;
      if (Number.isFinite(parsedPull) && parsedPull > 0) {
        this.adaptivePullPageSize = parsedPull;
      }
      const rawPush = await AsyncStorage.getItem(ADAPTIVE_PUSH_BATCH_KEY);
      const parsedPush = rawPush != null ? Number(rawPush) : NaN;
      if (Number.isFinite(parsedPush) && parsedPush > 0) {
        this.adaptivePushBatchSize = parsedPush;
      }
    } catch (err) {
      console.warn(
        '[NetworkProfileService] Failed to load throttle state:',
        err,
      );
    }
    this.loaded = true;
  }

  async getSyncKnobs(): Promise<SyncKnobs> {
    await this.load();
    return resolveSyncKnobs(
      this.adaptivePullPageSize,
      this.adaptivePushBatchSize,
    );
  }

  async recordPullPageDuration(durationMs: number): Promise<number> {
    await this.load();
    const knobs = resolveSyncKnobs(
      this.adaptivePullPageSize,
      this.adaptivePushBatchSize,
    );
    const next = nextAdaptivePullPageSize(knobs.pullPageSize, durationMs);
    this.adaptivePullPageSize = next;
    await this.persist(ADAPTIVE_PULL_PAGE_KEY, next);
    return next;
  }

  async recordPushBatchDuration(durationMs: number): Promise<number> {
    await this.load();
    const knobs = resolveSyncKnobs(
      this.adaptivePullPageSize,
      this.adaptivePushBatchSize,
    );
    const next = nextAdaptivePushBatchSize(knobs.pushBatchSize, durationMs);
    this.adaptivePushBatchSize = next;
    await this.persist(ADAPTIVE_PUSH_BATCH_KEY, next);
    return next;
  }

  async shrinkPushBatchAfterFailure(failedLength: number): Promise<number> {
    await this.load();
    const next = nextSizeAfterFailure(failedLength, PUSH_BATCH_FLOOR);
    this.adaptivePushBatchSize = next;
    await this.persist(ADAPTIVE_PUSH_BATCH_KEY, next);
    return next;
  }

  async shrinkPullPageAfterFailure(failedLength: number): Promise<number> {
    await this.load();
    const next = nextSizeAfterFailure(failedLength, PULL_PAGE_FLOOR);
    this.adaptivePullPageSize = next;
    await this.persist(ADAPTIVE_PULL_PAGE_KEY, next);
    return next;
  }

  private async persist(key: string, value: number): Promise<void> {
    try {
      await AsyncStorage.setItem(key, String(value));
    } catch (err) {
      console.warn(`[NetworkProfileService] Failed to persist ${key}:`, err);
    }
  }
}

export const networkProfileService = NetworkProfileService.getInstance();
