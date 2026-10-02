import { AppState, type AppStateStatus } from 'react-native';
import { getActiveProfile } from '../profiles/ProfileRuntime';
import { loadAutoSyncSettings } from './AutoSyncSettingsService';
import { syncService } from './SyncService';

export class AutoSyncService {
  private static instance: AutoSyncService;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private appState: AppStateStatus = AppState.currentState;
  private started = false;
  private generation = 0;

  private constructor() {}

  public static getInstance(): AutoSyncService {
    if (!AutoSyncService.instance) {
      AutoSyncService.instance = new AutoSyncService();
    }

    return AutoSyncService.instance;
  }

  public start(): () => void {
    if (this.started) {
      return () => undefined;
    }

    this.started = true;

    const subscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange,
    );

    void this.scheduleNext();

    return () => {
      subscription.remove();
      this.stop();
    };
  }

  public stop(): void {
    this.started = false;
    this.generation += 1;
    this.clearTimer();
  }

  public refresh(): void {
    this.generation += 1;
    this.clearTimer();

    if (this.started && this.appState === 'active') {
      void this.scheduleNext();
    }
  }

  private readonly handleAppStateChange = (nextState: AppStateStatus): void => {
    this.appState = nextState;
    this.generation += 1;
    this.clearTimer();

    if (nextState === 'active' && this.started) {
      void this.scheduleNext();
    }
  };

  private async scheduleNext(): Promise<void> {
    const generation = ++this.generation;

    if (!this.started || this.appState !== 'active') {
      return;
    }

    const profileId = getActiveProfile().id;
    const settings = await loadAutoSyncSettings();

    if (
      generation !== this.generation ||
      !this.started ||
      this.appState !== 'active' ||
      getActiveProfile().id !== profileId ||
      !settings.enabled
    ) {
      return;
    }

    this.timer = setTimeout(() => {
      void this.runScheduledSync(profileId, generation);
    }, settings.intervalMs);
  }

  private async runScheduledSync(
    profileId: string,
    generation: number,
  ): Promise<void> {
    this.timer = null;

    if (
      generation !== this.generation ||
      !this.started ||
      this.appState !== 'active' ||
      getActiveProfile().id !== profileId
    ) {
      return;
    }

    if (syncService.getIsSyncing()) {
      await this.scheduleNext();
      return;
    }

    try {
      await syncService.syncObservations({
        includeAttachments: false,
        silent: true,
      });
    } catch {
      // Auto-sync failures are intentionally silent. Status UI will surface
      // the result without using manual-sync notifications or modals.
    }

    if (
      this.started &&
      this.appState === 'active' &&
      getActiveProfile().id === profileId
    ) {
      await this.scheduleNext();
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export const autoSyncService = AutoSyncService.getInstance();
