import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/material-design-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatRelativeTime } from '../utils/dateUtils';
import { syncService } from '../services/SyncService';
import { useSyncContext } from '../contexts/SyncContext';
import RNFS from 'react-native-fs';
import { databaseService } from '../database/DatabaseService';
import { getUserInfo } from '../api/synkronus/Auth';
import colors from '../theme/colors';

type ActiveOperation = 'sync' | 'update' | 'sync_then_update' | null;

const SyncScreen = () => {
  const syncContextValue = useSyncContext();
  const {
    syncState,
    startSync,
    finishSync,
    cancelSync,
    clearError,
    updateProgress,
  } = syncContextValue;
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [pendingUploads, setPendingUploads] = useState<{
    count: number;
    sizeMB: number;
  }>({ count: 0, sizeMB: 0 });
  const [pendingObservations, setPendingObservations] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [appBundleVersion, setAppBundleVersion] = useState<string>('0');
  const [serverBundleVersion, setServerBundleVersion] =
    useState<string>('Unknown');
  const [animatedProgress] = useState(new Animated.Value(0));
  const [activeOperation, setActiveOperation] = useState<ActiveOperation>(null);

  const updatePendingUploads = useCallback(async () => {
    try {
      const pendingUploadDirectory = `${RNFS.DocumentDirectoryPath}/attachments/pending_upload`;
      await RNFS.mkdir(pendingUploadDirectory);
      const files = await RNFS.readDir(pendingUploadDirectory);
      const attachmentFiles = files.filter(file => file.isFile());

      const count = attachmentFiles.length;
      const totalSizeBytes = attachmentFiles.reduce(
        (sum, file) => sum + file.size,
        0,
      );
      const sizeMB = totalSizeBytes / (1024 * 1024);

      setPendingUploads({ count, sizeMB });
    } catch (error) {
      console.error('Failed to get pending uploads info:', error);
      setPendingUploads({ count: 0, sizeMB: 0 });
    }
  }, []);

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

  const refreshAfterOperation = useCallback(async () => {
    const syncTime = new Date().toISOString();
    setLastSync(syncTime);
    try {
      await AsyncStorage.setItem('@lastSync', syncTime);
    } catch (e) {
      console.warn('Failed to save last sync time:', e);
    }
    try {
      await updatePendingUploads();
    } catch (e) {
      console.warn('Failed to update pending uploads:', e);
    }
    try {
      await updatePendingObservations();
    } catch (e) {
      console.warn('Failed to update pending observations:', e);
    }
  }, [updatePendingUploads, updatePendingObservations]);

  const handleSync = useCallback(async () => {
    if (syncState.isActive) return;

    let syncError: string | undefined;

    try {
      startSync(true);
      setActiveOperation('sync');

      const syncPromise = syncService.syncObservations(true);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Sync timed out after 30 minutes')),
          30 * 60 * 1000,
        );
      });

      await Promise.race([syncPromise, timeoutPromise]);
      await refreshAfterOperation();
    } catch (error) {
      syncError = (error as Error).message || 'Unknown error occurred';
      Alert.alert('Sync Failed', syncError);
    } finally {
      finishSync(syncError);
      setActiveOperation(null);
    }
  }, [syncState.isActive, startSync, finishSync, refreshAfterOperation]);

  const performAppBundleUpdate = useCallback(async () => {
    try {
      startSync(true);
      setActiveOperation('update');

      await syncService.updateAppBundle();
      setUpdateAvailable(false);
      await refreshAfterOperation();
      finishSync();

      const formService = await import('../services/FormService');
      const fs = await formService.FormService.getInstance();
      await fs.invalidateCache();
    } catch (error) {
      const errorMessage = (error as Error).message;
      finishSync(errorMessage);
      if (errorMessage.includes('401')) {
        Alert.alert(
          'Authentication Error',
          'Your session has expired. Please log in again.',
        );
      } else {
        Alert.alert('Update Failed', errorMessage);
      }
    } finally {
      setActiveOperation(null);
    }
  }, [startSync, finishSync, refreshAfterOperation]);

  const performSyncThenUpdate = useCallback(async () => {
    try {
      startSync(true);
      setActiveOperation('sync_then_update');

      await syncService.syncObservations(true);
      await syncService.updateAppBundle();
      setUpdateAvailable(false);
      await refreshAfterOperation();
      finishSync();

      const formService = await import('../services/FormService');
      const fs = await formService.FormService.getInstance();
      await fs.invalidateCache();
    } catch (error) {
      const errorMessage = (error as Error).message;
      finishSync(errorMessage);
      Alert.alert('Operation Failed', errorMessage);
    } finally {
      setActiveOperation(null);
    }
  }, [startSync, finishSync, refreshAfterOperation]);

  const handleCustomAppUpdate = useCallback(async () => {
    if (syncState.isActive) return;

    const userInfo = await getUserInfo();
    if (!userInfo) {
      Alert.alert('Authentication Error', 'Please log in to update app bundle');
      return;
    }

    if (!updateAvailable && !isAdmin) {
      Alert.alert(
        'Permission Denied',
        'Admin privileges required to force update app bundle',
      );
      return;
    }

    const hasPendingData = pendingObservations > 0 || pendingUploads.count > 0;

    if (hasPendingData) {
      const pendingCount = pendingObservations + pendingUploads.count;
      Alert.alert(
        'Unsynchronized Data',
        `You have ${pendingCount} unsynchronized item${pendingCount !== 1 ? 's' : ''}. Sync your data before updating to avoid data loss.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sync & Update',
            onPress: () => performSyncThenUpdate(),
          },
        ],
      );
      return;
    }

    await performAppBundleUpdate();
  }, [
    syncState.isActive,
    updateAvailable,
    isAdmin,
    pendingObservations,
    pendingUploads.count,
    performAppBundleUpdate,
    performSyncThenUpdate,
  ]);

  const checkForUpdates = useCallback(async () => {
    try {
      const hasUpdate = await syncService.checkForUpdates();
      setUpdateAvailable(hasUpdate);
      const currentVersion = (await AsyncStorage.getItem('@appVersion')) || '0';
      setAppBundleVersion(currentVersion);
      try {
        const { synkronusApi } = await import('../api/synkronus/index');
        const manifest = await synkronusApi.getManifest();
        setServerBundleVersion(manifest.version);
      } catch {
        setServerBundleVersion(currentVersion);
      }
    } catch (error) {
      console.warn('Update check failed:', error);
    }
  }, []);

  const getStatusText = (): string => {
    if (syncState.isActive) {
      if (activeOperation === 'update') return 'Updating app...';
      if (activeOperation === 'sync_then_update')
        return 'Syncing & updating...';
      return 'Syncing...';
    }
    if (syncState.error) return 'Error';
    if (pendingObservations > 0 || pendingUploads.count > 0)
      return 'Pending sync';
    return 'All synced';
  };

  const status = getStatusText();
  const statusColor = syncState.isActive
    ? colors.brand.primary[500]
    : syncState.error
      ? colors.semantic.error[500]
      : pendingObservations > 0 || pendingUploads.count > 0
        ? colors.semantic.warning[500]
        : colors.semantic.success[500];

  useEffect(() => {
    const unsubscribeStatus = syncService.subscribeToStatusUpdates(() => {});
    const unsubscribeProgress =
      syncService.subscribeToProgressUpdates(updateProgress);

    const initialize = async () => {
      await syncService.initialize();
      await checkForUpdates();
      const userInfo = await getUserInfo();
      setIsAdmin(userInfo?.role === 'admin');
      const lastSyncTime = await AsyncStorage.getItem('@lastSync');
      if (lastSyncTime) {
        setLastSync(lastSyncTime);
      }
      await updatePendingUploads();
      await updatePendingObservations();
    };

    initialize();

    return () => {
      unsubscribeStatus();
      unsubscribeProgress();
    };
  }, [
    checkForUpdates,
    updatePendingUploads,
    updatePendingObservations,
    updateProgress,
  ]);

  useEffect(() => {
    if (!syncState.progress || !syncState.isActive) {
      Animated.timing(animatedProgress, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
      return;
    }

    const { current, total } = syncState.progress;
    const percent =
      total && total > 0
        ? Math.max(0, Math.min(100, (current / total) * 100))
        : 0;

    Animated.timing(animatedProgress, {
      toValue: percent,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [syncState.progress, syncState.isActive, animatedProgress]);

  useEffect(() => {
    if (!syncState.isActive && !syncState.error) {
      updatePendingUploads();
      updatePendingObservations();
      checkForUpdates();
    }
  }, [
    syncState.isActive,
    syncState.error,
    updatePendingUploads,
    updatePendingObservations,
    checkForUpdates,
  ]);

  const getProgressTitle = (): string => {
    if (activeOperation === 'sync_then_update') return 'Syncing & Updating';
    if (activeOperation === 'update') return 'Updating App Bundle';
    return 'Syncing Data';
  };

  const isSyncButtonActive =
    activeOperation === 'sync' || activeOperation === 'sync_then_update';
  const isUpdateButtonActive =
    activeOperation === 'update' || activeOperation === 'sync_then_update';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sync</Text>
        <Text style={styles.subtitle}>Synchronize your data</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.statusCardsContainer}>
          <TouchableOpacity
            style={[
              styles.statusCard,
              !syncState.isActive &&
                (pendingObservations > 0 || pendingUploads.count > 0) &&
                styles.statusCardClickable,
            ]}
            onPress={() => {
              if (
                !syncState.isActive &&
                (pendingObservations > 0 || pendingUploads.count > 0)
              ) {
                handleSync();
              }
            }}
            disabled={syncState.isActive}
            activeOpacity={
              syncState.isActive ||
              (pendingObservations === 0 && pendingUploads.count === 0)
                ? 1
                : 0.7
            }>
            <View style={styles.statusCardHeader}>
              <Icon
                name={
                  syncState.isActive
                    ? 'sync'
                    : syncState.error
                      ? 'alert-circle'
                      : pendingObservations > 0 || pendingUploads.count > 0
                        ? 'clock-alert-outline'
                        : 'check-circle'
                }
                size={20}
                color={statusColor}
              />
              <Text style={styles.statusCardTitle}>Status</Text>
            </View>
            <Text style={[styles.statusCardValue, { color: statusColor }]}>
              {status}
            </Text>
            {!syncState.isActive &&
              !syncState.error &&
              (pendingObservations > 0 || pendingUploads.count > 0) && (
                <Text style={styles.statusCardSubtext}>Tap to sync now</Text>
              )}
          </TouchableOpacity>

          <View style={styles.statusCard}>
            <View style={styles.statusCardHeader}>
              <Icon
                name="clock-outline"
                size={20}
                color={colors.neutral[600]}
              />
              <Text style={styles.statusCardTitle}>Last Sync</Text>
            </View>
            <Text style={styles.statusCardValue}>
              {lastSync ? formatRelativeTime(lastSync) : 'Never'}
            </Text>
          </View>
        </View>

        {(pendingObservations > 0 || pendingUploads.count > 0) && (
          <View style={styles.pendingSection}>
            <Text style={styles.sectionTitle}>Pending Items</Text>
            {pendingObservations > 0 && (
              <View style={styles.pendingItem}>
                <Icon
                  name="clipboard-text-outline"
                  size={20}
                  color={colors.semantic.warning[500]}
                />
                <View style={styles.pendingItemContent}>
                  <Text style={styles.pendingItemLabel}>Observations</Text>
                  <Text style={styles.pendingItemValue}>
                    {pendingObservations} record
                    {pendingObservations !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            )}
            {pendingUploads.count > 0 && (
              <View style={styles.pendingItem}>
                <Icon
                  name="file-upload-outline"
                  size={20}
                  color={colors.semantic.warning[500]}
                />
                <View style={styles.pendingItemContent}>
                  <Text style={styles.pendingItemLabel}>Attachments</Text>
                  <Text style={styles.pendingItemValue}>
                    {pendingUploads.count} file
                    {pendingUploads.count !== 1 ? 's' : ''} (
                    {pendingUploads.sizeMB.toFixed(2)} MB)
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.versionCard}>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>App Bundle</Text>
            <View style={styles.versionValues}>
              <View style={styles.versionItem}>
                <Text style={styles.versionItemLabel}>Local</Text>
                <Text style={styles.versionItemValue}>{appBundleVersion}</Text>
              </View>
              <View style={styles.versionDivider} />
              <View style={styles.versionItem}>
                <Text style={styles.versionItemLabel}>Server</Text>
                <Text style={styles.versionItemValue}>
                  {serverBundleVersion}
                </Text>
              </View>
            </View>
          </View>
          {updateAvailable && (
            <View style={styles.updateBadge}>
              <Icon
                name="arrow-down-circle"
                size={16}
                color={colors.semantic.success[500]}
              />
              <Text style={styles.updateBadgeText}>Update available</Text>
            </View>
          )}
        </View>

        {syncState.isActive && syncState.progress && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Icon name="sync" size={20} color={colors.brand.primary[500]} />
              <Text style={styles.progressTitle}>{getProgressTitle()}</Text>
            </View>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: animatedProgress.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round(
                (syncState.progress.current / syncState.progress.total) * 100,
              )}
              %
            </Text>
            {syncState.canCancel && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={cancelSync}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {syncState.error && (
          <View style={styles.errorCard}>
            <View style={styles.errorHeader}>
              <Icon
                name="alert-circle"
                size={20}
                color={colors.semantic.error.ios}
              />
              <Text style={styles.errorTitle}>Error</Text>
            </View>
            <Text style={styles.errorText}>{syncState.error}</Text>
            <TouchableOpacity style={styles.dismissButton} onPress={clearError}>
              <Text style={styles.dismissButtonText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.primaryButton,
              syncState.isActive && styles.buttonDisabled,
            ]}
            onPress={handleSync}
            disabled={syncState.isActive}>
            {isSyncButtonActive ? (
              <ActivityIndicator size="small" color={colors.neutral.white} />
            ) : (
              <Icon name="sync" size={20} color={colors.neutral.white} />
            )}
            <Text style={styles.actionButtonText}>
              {isSyncButtonActive ? 'Syncing...' : 'Sync Data'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.secondaryButton,
              (syncState.isActive || (!updateAvailable && !isAdmin)) &&
                styles.buttonDisabled,
            ]}
            onPress={handleCustomAppUpdate}
            disabled={syncState.isActive || (!updateAvailable && !isAdmin)}>
            {isUpdateButtonActive ? (
              <ActivityIndicator
                size="small"
                color={colors.brand.primary[500]}
              />
            ) : (
              <Icon
                name="download"
                size={20}
                color={colors.brand.primary[500]}
              />
            )}
            <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
              {isUpdateButtonActive ? 'Updating...' : 'Update App Bundle'}
            </Text>
          </TouchableOpacity>

          {!syncState.isActive && updateAvailable && (
            <Text style={styles.updateNotification}>Update available</Text>
          )}

          {!syncState.isActive && !updateAvailable && !isAdmin && (
            <Text style={styles.hintText}>No updates available</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    padding: 16,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.neutral[900],
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral[600],
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  statusCardsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statusCard: {
    flex: 1,
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusCardClickable: {
    borderWidth: 2,
    borderColor: colors.brand.primary[200],
  },
  statusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusCardTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.neutral[600],
    textTransform: 'uppercase',
  },
  statusCardValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  statusCardSubtext: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 4,
  },
  pendingSection: {
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[900],
    marginBottom: 12,
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  pendingItemContent: {
    flex: 1,
  },
  pendingItemLabel: {
    fontSize: 14,
    color: colors.neutral[600],
    marginBottom: 2,
  },
  pendingItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  versionCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.neutral[600],
  },
  versionValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  versionItem: {
    alignItems: 'flex-end',
  },
  versionItemLabel: {
    fontSize: 11,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  versionItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  versionDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.neutral[200],
  },
  updateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  updateBadgeText: {
    fontSize: 12,
    color: colors.semantic.success[500],
    fontWeight: '500',
  },
  progressCard: {
    backgroundColor: colors.brand.primary[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand.primary[500],
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.brand.primary[500],
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.brand.primary[200],
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brand.primary[500],
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: colors.neutral[600],
    textAlign: 'center',
    marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: colors.semantic.error[500],
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'center',
  },
  cancelButtonText: {
    color: colors.neutral.white,
    fontSize: 14,
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: colors.semantic.error[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.semantic.error[500],
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.semantic.error[500],
  },
  errorText: {
    fontSize: 14,
    color: colors.semantic.error[600],
    marginBottom: 12,
  },
  dismissButton: {
    backgroundColor: colors.semantic.error[500],
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  dismissButtonText: {
    color: colors.neutral.white,
    fontSize: 14,
    fontWeight: '600',
  },
  actionsSection: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: colors.brand.primary[500],
  },
  secondaryButton: {
    backgroundColor: colors.neutral.white,
    borderWidth: 2,
    borderColor: colors.brand.primary[500],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral.white,
  },
  secondaryButtonText: {
    color: colors.brand.primary[500],
  },
  hintText: {
    fontSize: 12,
    color: colors.neutral[500],
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 4,
  },
  updateNotification: {
    fontSize: 12,
    color: colors.semantic.warning[600],
    textAlign: 'center',
    marginTop: 4,
  },
});

export default SyncScreen;
