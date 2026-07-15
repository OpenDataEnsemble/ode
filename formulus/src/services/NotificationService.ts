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

class NotificationService {
  private syncNotificationId = 'sync_progress';
  private channelId = 'sync_channel';
  private isConfigured = false;
  private foregroundServiceRunning = false;

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
          channelId: this.channelId,
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

    await notifee.displayNotification({
      id: this.syncNotificationId,
      title: 'Syncing…',
      body: 'Starting…',
      android: {
        channelId: this.channelId,
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
    // Delayed cleanup: catch any fire-and-forget showSyncProgress calls
    // that were already in-flight when we stopped the service
    const cleanupTimer = setTimeout(async () => {
      try {
        await notifee.cancelNotification(this.syncNotificationId);
      } catch (_) {
        // ignore
      }
    }, 1000);
    // In Node/Jest, unref avoids keeping the process alive.
    if (
      typeof cleanupTimer === 'object' &&
      cleanupTimer !== null &&
      'unref' in cleanupTimer &&
      typeof cleanupTimer.unref === 'function'
    ) {
      cleanupTimer.unref();
    }
  }

  async showSyncComplete(success: boolean, error?: string) {
    await this.configure();

    if (success) {
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });

      await notifee.displayNotification({
        id: `sync_done_${Date.now()}`,
        title: `Sync completed @ ${timeString}`,
        body: 'All data synchronized successfully',
        android: {
          channelId: this.channelId,
          autoCancel: true,
          ongoing: false,
          pressAction: { id: 'default' },
        },
      });
    } else {
      await notifee.displayNotification({
        id: `sync_done_${Date.now()}`,
        title: 'Sync failed',
        body: error || 'An error occurred during synchronization',
        android: {
          channelId: this.channelId,
          autoCancel: true,
          ongoing: false,
          pressAction: { id: 'default' },
        },
      });
    }
  }

  async showSyncCanceled() {
    await this.configure();
    await notifee.displayNotification({
      id: `sync_done_${Date.now()}`,
      title: 'Sync canceled',
      body: 'Synchronization was canceled',
      android: {
        channelId: this.channelId,
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
