import { Platform } from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidForegroundServiceType,
} from '@notifee/react-native';
import { SyncProgress } from '../contexts/SyncContext';

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

    const percentage =
      progress.total > 0
        ? Math.round((progress.current / progress.total) * 100)
        : 0;

    try {
      await notifee.displayNotification({
        id: this.syncNotificationId,
        title: this.getPhaseText(progress.phase),
        body: `${percentage}%`,
        android: {
          channelId: this.channelId,
          ongoing: true,
          progress: {
            max: 100,
            current: percentage,
            indeterminate: progress.total === 0,
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
      title: 'Syncing...',
      body: 'Starting...',
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
    setTimeout(async () => {
      try {
        await notifee.cancelNotification(this.syncNotificationId);
      } catch (_) {
        // ignore
      }
    }, 1000);
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

  private getPhaseText(phase: SyncProgress['phase']): string {
    switch (phase) {
      case 'pull':
        return 'Downloading data';
      case 'push':
        return 'Uploading observations';
      case 'attachments_download':
        return 'Updating app bundle';
      case 'attachments_upload':
        return 'Uploading attachments';
      default:
        return 'Syncing';
    }
  }
}

export const notificationService = new NotificationService();
