import notifee, {
  AndroidImportance,
  AndroidStyle,
  AndroidAction,
} from '@notifee/react-native';
import {SyncProgress} from '../contexts/SyncContext';

class NotificationService {
  private syncNotificationId = 'sync_progress';
  private completionNotificationId = 'sync_completion';
  private channelId = 'sync_channel';
  private isConfigured = false;

  async configure() {
    if (this.isConfigured) return;

    // Request permissions
    await notifee.requestPermission();

    // Create notification channel for Android
    await notifee.createChannel({
      id: this.channelId,
      name: 'Sync Progress',
      description: 'Shows progress of data synchronization',
      importance: AndroidImportance.DEFAULT,
      sound: undefined, // No sound
      vibration: false,
    });

    this.isConfigured = true;
    console.log('Notifee notification service configured');
  }

  async showSyncProgress(progress: SyncProgress) {
    await this.configure();

    const percentage =
      progress.total > 0
        ? Math.round((progress.current / progress.total) * 100)
        : 0;
    const phaseText = this.getPhaseText(progress.phase);

    let title = 'Syncing data...';
    let message = `${phaseText}: ${progress.current}/${progress.total}`;

    if (progress.details) {
      message += ` - ${progress.details}`;
    }

    const cancelAction: AndroidAction = {
      title: 'Cancel',
      pressAction: {
        id: 'cancel_sync',
      },
    };

    await notifee.displayNotification({
      id: this.syncNotificationId,
      title,
      body: message,
      android: {
        channelId: this.channelId,
        ongoing: true, // Makes notification persistent
        style: {
          type: AndroidStyle.BIGTEXT,
          text: message,
        },
        progress: {
          max: 100,
          current: percentage,
          indeterminate: progress.total === 0,
        },
        actions: [cancelAction],
        pressAction: {
          id: 'default',
        },
      },
    });
  }

  async showSyncComplete(success: boolean, error?: string) {
    await this.configure();

    // Cancel the ongoing notification completely
    console.log(
      'Canceling progress notification with ID:',
      this.syncNotificationId,
    );

    // First, update the notification to make it non-ongoing, then cancel it
    await notifee.displayNotification({
      id: this.syncNotificationId,
      title: 'Sync completing...',
      body: 'Finalizing sync...',
      android: {
        channelId: this.channelId,
        ongoing: false, // Make it non-ongoing so it can be cancelled
        autoCancel: true,
      },
    });

    // Now cancel it
    await notifee.cancelNotification(this.syncNotificationId);
    console.log('Progress notification cancellation completed');

    if (success) {
      // Show a fresh completion notification with timestamp
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });

      await notifee.displayNotification({
        id: `sync_completed_${Date.now()}`, // Unique ID each time
        title: `Sync completed @ ${timeString}`,
        body: 'All data synchronized successfully',
        android: {
          channelId: this.channelId,
          autoCancel: true,
          smallIcon: 'ic_launcher',
          ongoing: false,
          // No actions at all - completely fresh notification
          pressAction: {
            id: 'default',
          },
        },
      });
    } else {
      // For errors, show a simple error notification
      await notifee.displayNotification({
        id: `sync_failed_${Date.now()}`, // Unique ID each time
        title: 'Sync failed',
        body: error || 'An error occurred during synchronization',
        android: {
          channelId: this.channelId,
          autoCancel: true,
          smallIcon: 'ic_launcher',
          ongoing: false,
          pressAction: {
            id: 'default',
          },
        },
      });
    }
  }

  async showSyncCanceled() {
    await this.configure();

    // Remove the ongoing notification
    await notifee.cancelNotification(this.syncNotificationId);

    // Small delay to ensure the previous notification is fully canceled
    await new Promise<void>(resolve => setTimeout(() => resolve(), 100));

    // Show cancellation notification with different ID
    await notifee.displayNotification({
      id: `${this.completionNotificationId}_canceled`,
      title: 'Sync canceled',
      body: 'Data synchronization was canceled by user',
      android: {
        channelId: this.channelId,
        autoCancel: true,
        smallIcon: 'ic_launcher',
        pressAction: {
          id: 'default',
        },
        actions: [], // Explicitly remove all actions (no Cancel button)
        ongoing: false, // Ensure it's not ongoing
      },
    });
  }

  async hideSyncProgress() {
    await notifee.cancelNotification(this.syncNotificationId);
  }

  async clearAllSyncNotifications() {
    // Clear all sync-related notifications to prevent stale data
    await notifee.cancelNotification(this.syncNotificationId);
    await notifee.cancelNotification(this.completionNotificationId);
    await notifee.cancelNotification(
      `${this.completionNotificationId}_canceled`,
    );
  }

  private getPhaseText(phase: SyncProgress['phase']): string {
    switch (phase) {
      case 'pull':
        return 'Downloading';
      case 'push':
        return 'Uploading observations';
      case 'attachments_download':
        return 'Downloading attachments';
      case 'attachments_upload':
        return 'Uploading attachments';
      default:
        return 'Syncing';
    }
  }
}

export const notificationService = new NotificationService();
