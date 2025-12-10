import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  SafeAreaView,
  ScrollView,
  AppState
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncService } from '../services/SyncService';
import { useSyncContext } from '../contexts/SyncContext';
import RNFS from 'react-native-fs';
import { databaseService } from '../database/DatabaseService';
import {getUserInfo} from '../api/synkronus/Auth';

const SyncScreen = () => {
  const {
    syncState,
    startSync,
    updateProgress,
    finishSync,
    cancelSync,
    clearError,
  } = useSyncContext();
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Loading...');
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [dataVersion, setDataVersion] = useState<number>(0);
  const [pendingUploads, setPendingUploads] = useState<{
    count: number;
    sizeMB: number;
  }>({count: 0, sizeMB: 0});
  const [pendingObservations, setPendingObservations] = useState<number>(0);
  const [backgroundSyncEnabled, setBackgroundSyncEnabled] =
    useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [appBundleVersion, setAppBundleVersion] = useState<string>('0');
  const [serverBundleVersion, setServerBundleVersion] =
    useState<string>('Unknown');

  // Get pending upload info
  const updatePendingUploads = useCallback(async () => {
    try {
      const pendingUploadDirectory = `${RNFS.DocumentDirectoryPath}/attachments/pending_upload`;

      // Ensure directory exists
      await RNFS.mkdir(pendingUploadDirectory);

      // Get all files in pending_upload directory
      const files = await RNFS.readDir(pendingUploadDirectory);
      const attachmentFiles = files.filter(file => file.isFile());

      const count = attachmentFiles.length;
      const totalSizeBytes = attachmentFiles.reduce(
        (sum, file) => sum + file.size,
        0,
      );
      const sizeMB = totalSizeBytes / (1024 * 1024);

      setPendingUploads({count, sizeMB});
    } catch (error) {
      console.error('Failed to get pending uploads info:', error);
      setPendingUploads({count: 0, sizeMB: 0});
    }
  }, []);

  // Get pending observations count
  const updatePendingObservations = useCallback(async () => {
    try {
      const repo = databaseService.getLocalRepo();
      const pendingChanges = await repo.getPendingChanges();
      setPendingObservations(pendingChanges.length);
    } catch (error) {
      console.error('Failed to get pending observations count:', error);
      setPendingObservations(0);
    }
  }, []);

  // Handle sync operations
  const handleSync = useCallback(async () => {
    if (syncState.isActive) return; // Prevent multiple syncs

    try {
      startSync(true); // Allow cancellation
      const version = await syncService.syncObservations(true);
      setDataVersion(version);
      // Update pending uploads and observations after sync
      await updatePendingUploads();
      await updatePendingObservations();
      finishSync(); // Success
    } catch (error) {
      const errorMessage = (error as Error).message;
      finishSync(errorMessage); // Finish with error
      Alert.alert('Error', 'Failed to sync!\n' + errorMessage);
    }
  }, [updatePendingUploads, syncState.isActive, startSync, finishSync]);

  // Handle app updates
  const handleCustomAppUpdate = useCallback(async () => {
    if (syncState.isActive) return; // Prevent multiple syncs

    try {
      startSync(false); // App updates can't be cancelled easily
      await syncService.updateAppBundle();
      setLastSync(new Date().toLocaleTimeString());
      setUpdateAvailable(false);
      finishSync(); // Success
    } catch (error) {
      const errorMessage = (error as Error).message;
      finishSync(errorMessage); // Finish with error
      Alert.alert('Error', 'Failed to update app bundle!\n' + errorMessage);
    }
  }, [syncState.isActive, startSync, finishSync]);

  // Check for updates
  const checkForUpdates = useCallback(async (force: boolean = false) => {
    try {
      const hasUpdate = await syncService.checkForUpdates(force);
      setUpdateAvailable(hasUpdate);

      // Get current app bundle version
      const currentVersion = (await AsyncStorage.getItem('@appVersion')) || '0';
      setAppBundleVersion(currentVersion);

      // Get server bundle version
      try {
        const {synkronusApi} = await import('../api/synkronus/index');
        const manifest = await synkronusApi.getManifest();
        setServerBundleVersion(manifest.version);
      } catch (err) {
        // Server manifest unavailable
      }
    } catch (error) {
      // Update check failed
    }
  }, []);

  // Initialize component
  useEffect(() => {
    // Set up status updates
    const unsubscribe = syncService.subscribeToStatusUpdates(newStatus => {
      setStatus(newStatus);
    });

    // Initialize sync service
    const initialize = async () => {
      await syncService.initialize();
      await checkForUpdates(true); // Check for updates on initial load

      // Check if user is admin
      const userInfo = await getUserInfo();
      setIsAdmin(userInfo?.role === 'admin');

      // Get last sync time
      const lastSyncTime = await AsyncStorage.getItem('@lastSync');
      if (lastSyncTime) {
        setLastSync(lastSyncTime);
      }

      // Get last seen version
      const lastSeenVersion = await AsyncStorage.getItem('@last_seen_version');
      if (lastSeenVersion) {
        setDataVersion(parseInt(lastSeenVersion, 10));
      }

      // Get pending uploads and observations info
      await updatePendingUploads();
      await updatePendingObservations();
    };

    initialize();

    // Clean up subscription
    return () => {
      unsubscribe();
    };
  }, [checkForUpdates]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Synchronization</Text>

        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text style={styles.statusValue}>{status}</Text>
        </View>

        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Last Sync:</Text>
          <Text style={styles.statusValue}>
            {lastSync || 'Never'} @ version {dataVersion}
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>App Bundle:</Text>
          <Text style={styles.statusValue}>
            Local: {appBundleVersion} | Server: {serverBundleVersion}
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Pending Uploads:</Text>
          <Text style={styles.statusValue}>
            {pendingUploads.count} files ({pendingUploads.sizeMB.toFixed(2)} MB)
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Pending Observations:</Text>
          <Text style={styles.statusValue}>{pendingObservations} records</Text>
        </View>

        {/* Sync Progress Display */}
        {syncState.isActive && syncState.progress && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressTitle}>Sync Progress</Text>
            <Text style={styles.progressDetails}>
              {syncState.progress.details || 'Syncing...'}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${
                      (syncState.progress.current / syncState.progress.total) *
                      100
                    }%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {syncState.progress.current}/{syncState.progress.total} -{' '}
              {Math.round(
                (syncState.progress.current / syncState.progress.total) * 100,
              )}
              %
            </Text>
            {syncState.canCancel && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={cancelSync}>
                <Text style={styles.cancelButtonText}>Cancel Sync</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Error Display */}
        {syncState.error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{syncState.error}</Text>
            <TouchableOpacity
              style={styles.clearErrorButton}
              onPress={clearError}>
              <Text style={styles.clearErrorText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.button, syncState.isActive && styles.buttonDisabled]}
            onPress={handleSync}
            disabled={syncState.isActive}>
            <Text style={styles.buttonText}>
              {syncState.isActive ? 'Syncing...' : 'Sync data + attachments'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              (syncState.isActive || (!updateAvailable && !isAdmin)) &&
                styles.buttonDisabled,
            ]}
            onPress={handleCustomAppUpdate}
            disabled={syncState.isActive || (!updateAvailable && !isAdmin)}>
            <Text style={styles.buttonText}>
              {syncState.isActive
                ? 'Syncing...'
                : 'Update forms and custom app'}
            </Text>
          </TouchableOpacity>
          {!updateAvailable && !isAdmin && (
            <Text style={styles.hintText}>
              No updates available. Check your connection and try again.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Sync Details</Text>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Server:</Text>
            <Text style={styles.detailValue}>Synkronus</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Last Updated:</Text>
            <Text style={styles.detailValue}>
              {new Date().toLocaleDateString()}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusLabel: {
    fontSize: 16,
    color: '#666',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  section: {
    marginTop: 20,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    color: '#666',
    fontSize: 15,
  },
  detailValue: {
    color: '#333',
    fontSize: 15,
    fontWeight: '500',
  },
  progressContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  progressDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196f3',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  cancelButton: {
    backgroundColor: '#f44336',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignSelf: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    marginBottom: 10,
  },
  clearErrorButton: {
    backgroundColor: '#f44336',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignSelf: 'flex-end',
  },
  clearErrorText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  hintText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default SyncScreen;
