import { Platform } from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidForegroundServiceType,
} from '@notifee/react-native';
import type { SyncProgress } from '../sync/syncProgress';
import {
  syncProgressPercent,
  syncProgressPhaseTitle,
} from '../sync/syncProgress';
import {
  getSyncProgressDetailsForDisplay,
  shouldShowSyncProgressCurrentItem,
} from '../sync/syncProgressUi';
import { i18n } from '../i18n/instance';
import { logger } from '../diagnostics/logger';

export type SyncNotificationOutcome =
  | { kind: 'success' }
  | { kind: 'partial_success'; pendingAttachments: number }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: string };

/** White-on-transparent status-bar glyph — not the adaptive launcher icon. */
const SYNC_SMALL_ICON = 'ic_stat_formulus';

class NotificationService {
  private syncNotificationId = 'sync_progress';
  private channelId = 'sync_channel';
  private isConfigured = false;
  private foregroundServiceRunning = false;

  private androidDefaults() {
    return {
      channelId: this.channelId,
      smallIcon: SYNC_SMALL_ICON,
    };
  }

  async configure() {
    if (this.isConfigured) return;
    await notifee.requestPermission();
    await notifee.createChannel({
      id: this.channelId,
      name: 'Sync Progress',
      description: 'Shows progress of data synchronization',
      importance: AndroidImportance.DEFAULT,
      sound: undefined,
      vibration: false,
    });
    this.isConfigured = true;
  }

  async showSyncProgress(progress: SyncProgress) {
    if (!this.foregroundServiceRunning) return;

    const percentage = syncProgressPercent(progress);
    const indeterminate =
      progress.indeterminate === true || progress.total <= 0;
    const title = syncProgressPhaseTitle(progress.phase);
    const bodyParts: string[] = [];
    const displayDetails = getSyncProgressDetailsForDisplay(progress);
    if (displayDetails) {
      bodyParts.push(displayDetails);
    }
    if (
      shouldShowSyncProgressCurrentItem(progress) &&
      progress.currentItem?.trim()
    ) {
      bodyParts.push(progress.currentItem.trim());
    }
    const body =
      bodyParts.length > 0
        ? bodyParts.join(' · ')
        : indeterminate
          ? i18n.t('sync.progress.inProgress')
          : percentage != null
            ? `${percentage}%`
            : 'In progress…';

    try {
      await notifee.displayNotification({
        id: this.syncNotificationId,
        title,
        body,
        android: {
          ...this.androidDefaults(),
          ongoing: true,
          progress: {
            max: 100,
            current: percentage ?? 0,
            indeterminate,
          },
        },
      });
    } catch (e) {
      console.warn('Failed to update sync progress notification:', e);
    }
  }

  async startForegroundService() {
    if (Platform.OS !== 'android' || this.foregroundServiceRunning) return;
    await this.configure();

    await logger.breadcrumb('fgs', 'start');
    await notifee.displayNotification({
      id: this.syncNotificationId,
      title: 'Syncing…',
      body: 'Starting…',
      android: {
        ...this.androidDefaults(),
        asForegroundService: true,
        foregroundServiceTypes: [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
        ],
        ongoing: true,
        progress: { max: 100, current: 0, indeterminate: true },
      },
    });
    this.foregroundServiceRunning = true;
  }

  async stopForegroundService() {
    if (Platform.OS !== 'android' || !this.foregroundServiceRunning) return;
    this.foregroundServiceRunning = false;
    await logger.breadcrumb('fgs', 'stop');
    try {
      await notifee.stopForegroundService();
    } catch (e) {
      console.warn('Failed to stop foreground service:', e);
    }
    try {
      await notifee.cancelNotification(this.syncNotificationId);
    } catch (e) {
      console.warn('Failed to cancel foreground notification:', e);
    }
    // Join delayed cleanup so it cannot cancel another profile's notification
    // after the caller has released its activity lease.
    await new Promise<void>(resolve => setTimeout(resolve, 1000));
    try {
      await notifee.cancelNotification(this.syncNotificationId);
    } catch (_) {
      // Best-effort cleanup.
    }
  }

  async showSyncComplete(outcome: SyncNotificationOutcome) {
    await this.configure();

    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });

    let title: string;
    let body: string;

    switch (outcome.kind) {
      case 'success':
        title = `Sync completed @ ${timeString}`;
        body = i18n.t('sync.notification.completed');
        break;
      case 'partial_success':
        title = i18n.t('sync.notification.completedWithPendingAttachments');
        body = i18n.t('sync.notification.pendingAttachmentsBody', {
          count: outcome.pendingAttachments,
        });
        break;
      case 'cancelled':
        title = i18n.t('sync.notification.cancelledTitle');
        body = i18n.t('sync.notification.cancelledBody');
        break;
      case 'failed':
        title = i18n.t('sync.notification.failedTitle');
        body = outcome.error || i18n.t('sync.notification.failedBody');
        break;
    }

    await notifee.displayNotification({
      id: `sync_done_${Date.now()}`,
      title,
      body,
      android: {
        ...this.androidDefaults(),
        autoCancel: true,
        ongoing: false,
        pressAction: { id: 'default' },
      },
    });
  }

  async hideSyncProgress() {
    await notifee.cancelNotification(this.syncNotificationId);
  }

  async clearAllSyncNotifications() {
    await notifee.cancelAllNotifications();
  }
}

export const notificationService = new NotificationService();
