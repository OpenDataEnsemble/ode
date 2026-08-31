import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { logger } from '../diagnostics/logger';
import Icon from '@react-native-vector-icons/material-design-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatRelativeTime } from '../utils/dateUtils';
import { syncService } from '../services/SyncService';
import { useSyncContext } from '../contexts/SyncContext';
import RNFS from 'react-native-fs';
import { databaseService } from '../database/DatabaseService';
import {
  getUserInfo,
  getUserFacingSyncErrorMessage,
} from '../api/synkronus/Auth';
import {
  PULL_PAGE_CEILING,
  PULL_PAGE_FLOOR,
  PUSH_BATCH_CEILING,
  PUSH_BATCH_FLOOR,
} from '../sync/networkProfile';
import { networkProfileService } from '../services/NetworkProfileService';
import { isCancelledError } from '../sync/transientRetry';
import {
  isRepositoryResetRequiredError,
  type RepositoryResetRequiredError,
} from '../errors/RepositoryResetRequiredError';
import { repositoryRecoveryService } from '../services/RepositoryRecoveryService';
import colors, { withAlpha } from '../theme/colors';
import { Button } from '../components/common';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useScreenShellStyle } from '../hooks/useScreenShellStyle';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeRadius,
  odeScreenHeaderHeight,
} from '../theme/odeDesign';
import {
  isNumericAppBundleVersionString,
  normalizeAppBundleVersion,
} from '../utils/appBundleVersion';
import { syncProgressPercent } from '../sync/syncProgress';
import {
  getSyncProgressCardTitle,
  getSyncProgressDetailsForDisplay,
  getSyncProgressPercentLabel,
  shouldShowSyncProgressCurrentItem,
  shouldShowSyncProgressPercent,
} from '../sync/syncProgressUi';
import { useTranslation } from 'react-i18next';

type ActiveOperation = 'sync' | 'update' | 'sync_then_update' | null;

const SyncScreen = () => {
  const { t } = useTranslation();
  const { themeColors, resolvedMode } = useAppTheme();
  const shellStyle = useScreenShellStyle();
  const isDark = resolvedMode === 'dark';
  const titleColor = isDark
    ? (themeColors.onSurface as string)
    : (colors.neutral[900] as string);
  const cardBg = themeColors.surface as string;
  const mutedForeground = (
    isDark ? colors.neutral[400] : colors.neutral[600]
  ) as string;
  const bundleSuccessGreen = colors.brand.primary['500'] as string;
  const bundleStatusOkBg = isDark
    ? withAlpha(colors.semantic.success[500] as unknown as string, 0.16)
    : (colors.semantic.success[50] as unknown as string);
  const bundleStatusOkText = (isDark
    ? colors.semantic.success[500]
    : colors.semantic.success[600]) as unknown as string;
  const bundleStatusUpdateBg = isDark
    ? withAlpha(colors.semantic.warning[500] as unknown as string, 0.2)
    : (colors.semantic.warning[50] as unknown as string);
  const bundleStatusUpdateText = colors.semantic
    .warning[600] as unknown as string;
  const _headerBg = isDark
    ? (colors.neutral[900] as string)
    : (colors.neutral[50] as string);
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
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [appBundleVersion, setAppBundleVersion] = useState<string>('0');
  const [serverBundleVersion, setServerBundleVersion] =
    useState<string>('Unknown');
  const [animatedProgress] = useState(new Animated.Value(0));
  const [activeOperation, setActiveOperation] = useState<ActiveOperation>(null);
  const [connectivityLevel, setConnectivityLevel] = useState(2);
  const [connectivityLabel, setConnectivityLabel] = useState('');
  const prevSyncWasActiveRef = useRef(false);

  const updatePendingUploads = useCallback(async () => {
    try {
      const pendingDirectory = `${RNFS.DocumentDirectoryPath}/attachments/pending`;
      await RNFS.mkdir(pendingDirectory);
      const files = await RNFS.readDir(pendingDirectory);
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

  const refreshUserRole = useCallback(async () => {
    try {
      const userInfo = await getUserInfo();
      setIsReadOnly(userInfo?.role === 'read-only');
    } catch {
      setIsReadOnly(false);
    }
  }, []);

  const refreshConnectivityStatus = useCallback(async () => {
    try {
      const knobs = await networkProfileService.getSyncKnobs();
      const pullProgress =
        (knobs.pullPageSize - PULL_PAGE_FLOOR) /
        (PULL_PAGE_CEILING - PULL_PAGE_FLOOR);
      const pushProgress =
        (knobs.pushBatchSize - PUSH_BATCH_FLOOR) /
        (PUSH_BATCH_CEILING - PUSH_BATCH_FLOOR);
      const score = Math.max(
        0,
        Math.min(1, pullProgress * 0.6 + pushProgress * 0.4),
      );
      const level = Math.min(5, Math.max(1, Math.floor(score * 5) + 1));
      const levelKey =
        level === 1
          ? 'sync.connectivity.cautious'
          : level === 2
            ? 'sync.connectivity.balancedLow'
            : level === 3
              ? 'sync.connectivity.balanced'
              : level === 4
                ? 'sync.connectivity.balancedHigh'
                : 'sync.connectivity.fast';
      setConnectivityLevel(level);
      setConnectivityLabel(t(levelKey));
    } catch {
      setConnectivityLevel(2);
      setConnectivityLabel(t('sync.connectivity.balancedLow'));
    }
  }, [t]);

  /**
   * Returns true when this device effectively has no local sync state to lose:
   * no observations persisted locally and no observation cursor in AsyncStorage.
   * Used to silently auto-recover on 409 `repository_reset_required` instead of
   * prompting the user to "erase and sync" for data that doesn't exist.
   */
  const localSyncStateIsEmpty = useCallback(async (): Promise<boolean> => {
    try {
      const lastSeen = await AsyncStorage.getItem('@last_seen_version');
      if (lastSeen != null && lastSeen !== '' && lastSeen !== '0') {
        return false;
      }
      const repo = databaseService.getLocalRepo();
      if (!repo) {
        return true;
      }
      const pending = await repo.getPendingChanges();
      return pending.length === 0;
    } catch (e) {
      console.warn('localSyncStateIsEmpty probe failed', e);
      return false;
    }
  }, []);

  const runRepositoryResetRecovery = useCallback(
    (
      error: RepositoryResetRequiredError,
      activeOp: ActiveOperation,
      afterWipe: () => Promise<void>,
      failureTitle: string,
    ) => {
      void (async () => {
        // Belt-and-suspenders: if there is no local state worth warning about
        // (fresh install that somehow still received a 409), silently wipe
        // and retry without disturbing the user.
        if (await localSyncStateIsEmpty()) {
          try {
            startSync(true);
            setActiveOperation(activeOp);
            await repositoryRecoveryService.wipeLocalSyncState(
              error.serverRepositoryGeneration,
            );
            await afterWipe();
            finishSync();
          } catch (e) {
            const msg = getUserFacingSyncErrorMessage(e);
            finishSync(msg);
            Alert.alert(failureTitle, msg);
          } finally {
            setActiveOperation(null);
          }
          return;
        }

        Alert.alert(
          t('sync.repositoryResetTitle'),
          t('sync.repositoryResetMessage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('sync.eraseAndSync'),
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  try {
                    startSync(true);
                    setActiveOperation(activeOp);
                    await repositoryRecoveryService.wipeLocalSyncState(
                      error.serverRepositoryGeneration,
                    );
                    await afterWipe();
                    finishSync();
                  } catch (e) {
                    const msg = getUserFacingSyncErrorMessage(e);
                    finishSync(msg);
                    Alert.alert(failureTitle, msg);
                  } finally {
                    setActiveOperation(null);
                  }
                })();
              },
            },
          ],
        );
      })();
    },
    [startSync, finishSync, localSyncStateIsEmpty, t],
  );

  const handleSync = useCallback(async () => {
    if (syncState.isActive || syncService.getIsSyncing()) return;

    let syncError: string | undefined;

    try {
      startSync(true);
      setActiveOperation('sync');

      await syncService.syncObservations(true);
      await refreshAfterOperation();
    } catch (error) {
      if (isCancelledError(error)) {
        // Cancel is requested, not a failure — do not Alert or paint the card red.
      } else if (isRepositoryResetRequiredError(error)) {
        syncError = getUserFacingSyncErrorMessage(error);
        runRepositoryResetRecovery(
          error,
          'sync',
          async () => {
            await syncService.syncObservations(true);
            await refreshAfterOperation();
          },
          t('sync.failed'),
        );
      } else {
        syncError = getUserFacingSyncErrorMessage(error);
        Alert.alert(t('sync.failed'), syncError);
      }
    } finally {
      finishSync(syncError);
      setActiveOperation(null);
    }
  }, [
    syncState.isActive,
    startSync,
    finishSync,
    refreshAfterOperation,
    runRepositoryResetRecovery,
    t,
  ]);

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
      if (isCancelledError(error)) {
        finishSync();
      } else {
        const errorMessage = (error as Error).message;
        finishSync(errorMessage);
        if (errorMessage.includes('401')) {
          Alert.alert(t('sync.authErrorTitle'), t('sync.sessionExpired'));
        } else {
          Alert.alert(t('sync.updateFailed'), errorMessage);
        }
      }
    } finally {
      setActiveOperation(null);
    }
  }, [startSync, finishSync, refreshAfterOperation, t]);

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
      if (isRepositoryResetRequiredError(error)) {
        const errorMessage = getUserFacingSyncErrorMessage(error);
        finishSync(errorMessage);
        runRepositoryResetRecovery(
          error,
          'sync_then_update',
          async () => {
            await syncService.syncObservations(true);
            await syncService.updateAppBundle();
            setUpdateAvailable(false);
            await refreshAfterOperation();
            const formService = await import('../services/FormService');
            const fs = await formService.FormService.getInstance();
            await fs.invalidateCache();
          },
          t('sync.operationFailed'),
        );
      } else if (isCancelledError(error)) {
        finishSync();
      } else {
        const errorMessage = getUserFacingSyncErrorMessage(error);
        finishSync(errorMessage);
        Alert.alert(t('sync.operationFailed'), errorMessage);
      }
    } finally {
      setActiveOperation(null);
    }
  }, [
    startSync,
    finishSync,
    refreshAfterOperation,
    runRepositoryResetRecovery,
    t,
  ]);

  const handleCustomAppUpdate = useCallback(async () => {
    if (syncState.isActive || syncService.getIsSyncing()) return;

    const userInfo = await getUserInfo();
    if (!userInfo) {
      Alert.alert(t('sync.authErrorTitle'), t('sync.loginToUpdateBundle'));
      return;
    }

    const hasPendingData = pendingObservations > 0 || pendingUploads.count > 0;

    if (hasPendingData) {
      const pendingCount = pendingObservations + pendingUploads.count;
      Alert.alert(
        t('sync.unsynchronizedDataTitle'),
        t('sync.unsynchronizedDataMessage', { count: pendingCount }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('sync.syncAndUpdate'),
            onPress: () => performSyncThenUpdate(),
          },
        ],
      );
      return;
    }

    await performAppBundleUpdate();
  }, [
    syncState.isActive,
    pendingObservations,
    pendingUploads.count,
    performAppBundleUpdate,
    performSyncThenUpdate,
    t,
  ]);

  const checkForUpdates = useCallback(async () => {
    try {
      const status = await syncService.getAppBundleStatus();
      if (status) {
        setAppBundleVersion(status.localVersion);
        setServerBundleVersion(status.serverVersion);
        setUpdateAvailable(status.updateAvailable);
      } else {
        const localNorm = normalizeAppBundleVersion(
          await AsyncStorage.getItem('@appVersion'),
        );
        setAppBundleVersion(
          isNumericAppBundleVersionString(localNorm) ? localNorm : 'Unknown',
        );
        setServerBundleVersion('Unknown');
        setUpdateAvailable(false);
      }
    } catch (error) {
      console.warn('Update check failed:', error);
    }
  }, []);

  const isObservationSyncActive =
    syncState.isActive &&
    (activeOperation === 'sync' || activeOperation === 'sync_then_update');

  const getObservationStatusText = (): string => {
    if (isObservationSyncActive) {
      if (activeOperation === 'sync_then_update')
        return t('sync.syncingAndUpdating');
      return t('sync.syncing');
    }
    if (syncState.error) return t('sync.error');
    if (pendingObservations > 0 || pendingUploads.count > 0)
      return t('sync.pendingSync');
    return t('sync.noPendingChanges');
  };

  const observationStatus = getObservationStatusText();
  /** Check icon on idle success uses ODE brand green; status text still follows app theme primary. */
  const odeStatusIconGreen = colors.brand.primary['500'] as string;
  const observationStatusColor = isObservationSyncActive
    ? themeColors.primary
    : syncState.error
      ? colors.semantic.error[500]
      : pendingObservations > 0 || pendingUploads.count > 0
        ? colors.semantic.warning[500]
        : (themeColors.primary as string);
  const observationStatusIconColor = isObservationSyncActive
    ? themeColors.primary
    : syncState.error
      ? colors.semantic.error[500]
      : pendingObservations > 0 || pendingUploads.count > 0
        ? colors.semantic.warning[500]
        : odeStatusIconGreen;

  useEffect(() => {
    const unsubscribeStatus = syncService.subscribeToStatusUpdates(() => {});
    const unsubscribeProgress =
      syncService.subscribeToProgressUpdates(updateProgress);

    const initialize = async () => {
      await syncService.initialize();
      await refreshUserRole();
      await refreshConnectivityStatus();
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
    updatePendingUploads,
    updatePendingObservations,
    updateProgress,
    refreshUserRole,
    refreshConnectivityStatus,
  ]);

  // Refresh pending count and bundle status whenever the Sync screen gains focus
  useFocusEffect(
    useCallback(() => {
      void logger.breadcrumb('screen', 'sync', { screen: 'Sync' });
      updatePendingUploads();
      updatePendingObservations();
      refreshUserRole();
      refreshConnectivityStatus();
      checkForUpdates();
    }, [
      updatePendingUploads,
      updatePendingObservations,
      refreshUserRole,
      refreshConnectivityStatus,
      checkForUpdates,
    ]),
  );

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

    const percent = syncProgressPercent(syncState.progress) ?? 0;

    Animated.timing(animatedProgress, {
      toValue: percent,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [syncState.progress, syncState.isActive, animatedProgress]);

  // Refresh bundle status when a sync/update finishes — not on initial mount, to avoid
  // racing the focus effect’s checkForUpdates() (see useFocusEffect above).
  useEffect(() => {
    const wasActive = prevSyncWasActiveRef.current;
    prevSyncWasActiveRef.current = syncState.isActive;

    if (!syncState.isActive && !syncState.error) {
      const timer = setTimeout(() => {
        updatePendingUploads();
        updatePendingObservations();
        refreshConnectivityStatus();
        if (wasActive) {
          checkForUpdates();
        }
      }, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [
    syncState.isActive,
    syncState.error,
    updatePendingUploads,
    updatePendingObservations,
    refreshConnectivityStatus,
    checkForUpdates,
  ]);

  const isSyncButtonActive =
    activeOperation === 'sync' || activeOperation === 'sync_then_update';
  const isUpdateButtonActive =
    activeOperation === 'update' || activeOperation === 'sync_then_update';

  const bundleVersionsKnown =
    appBundleVersion !== 'Unknown' && serverBundleVersion !== 'Unknown';

  const bundleStatusPill = (() => {
    if (updateAvailable) {
      return {
        bg: bundleStatusUpdateBg,
        icon: 'arrow-down-circle' as const,
        iconColor: bundleStatusUpdateText,
        label: t('sync.updateAvailable'),
        textColor: bundleStatusUpdateText,
      };
    }
    if (!bundleVersionsKnown) {
      return {
        bg: isDark
          ? withAlpha(colors.neutral[500] as string, 0.22)
          : (colors.neutral[100] as string),
        icon: 'information-outline' as const,
        iconColor: mutedForeground,
        label: t('sync.couldNotVerifyVersions'),
        textColor: themeColors.onSurface as string,
      };
    }
    return {
      bg: bundleStatusOkBg,
      icon: 'check-circle' as const,
      iconColor: bundleSuccessGreen,
      label: t('sync.upToDate'),
      textColor: bundleStatusOkText,
    };
  })();

  const hasPendingLocalObservationChanges =
    pendingObservations > 0 || pendingUploads.count > 0;
  const syncObservationsButtonLabel = syncState.isActive
    ? t('sync.syncing')
    : hasPendingLocalObservationChanges
      ? t('sync.syncObservationsPullPush')
      : t('sync.syncObservationsPull');

  const showObservationProgress =
    syncState.isActive && syncState.progress && activeOperation !== 'update';

  const showBundleProgress =
    syncState.isActive && syncState.progress && activeOperation === 'update';

  const progress = syncState.progress;
  const progressPercentLabel =
    progress && syncState.isActive && shouldShowSyncProgressPercent(progress)
      ? getSyncProgressPercentLabel(progress)
      : '';
  const progressDetailsLabel =
    progress && syncState.isActive
      ? getSyncProgressDetailsForDisplay(progress)
      : undefined;
  const progressShowsCurrentItem =
    progress != null && shouldShowSyncProgressCurrentItem(progress);
  const progressShowsIndeterminate =
    syncState.progress?.indeterminate === true ||
    (syncState.progress != null &&
      syncState.progress.total <= 0 &&
      syncProgressPercent(syncState.progress) == null);

  const progressCard =
    syncState.isActive && syncState.progress ? (
      <View
        style={[
          styles.card,
          styles.progressCard,
          {
            borderColor: themeColors.divider as string,
            backgroundColor: cardBg,
          },
        ]}>
        <View style={styles.progressHeader}>
          {progressShowsIndeterminate ? (
            <ActivityIndicator
              size="small"
              color={themeColors.primary as string}
            />
          ) : (
            <Icon name="sync" size={20} color={themeColors.primary as string} />
          )}
          <Text
            style={[
              styles.progressTitle,
              { color: themeColors.onSurface as string },
            ]}>
            {getSyncProgressCardTitle(syncState.progress, activeOperation)}
          </Text>
        </View>
        <View
          style={[
            styles.progressBar,
            {
              backgroundColor: isDark
                ? (colors.neutral[700] as string)
                : (colors.neutral[200] as string),
            },
          ]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: themeColors.primary as string,
                width: progressShowsIndeterminate
                  ? '30%'
                  : animatedProgress.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                opacity: progressShowsIndeterminate ? 0.55 : 1,
              },
            ]}
          />
        </View>
        {progressPercentLabel ? (
          <Text
            style={[
              styles.progressText,
              {
                color: isDark
                  ? (themeColors.onSurface as string)
                  : (colors.neutral[700] as string),
              },
            ]}>
            {progressPercentLabel}
          </Text>
        ) : null}
        {progressDetailsLabel ? (
          <Text
            style={[
              progressPercentLabel
                ? styles.progressSubtext
                : styles.progressText,
              {
                color: progressPercentLabel
                  ? mutedForeground
                  : isDark
                    ? (themeColors.onSurface as string)
                    : (colors.neutral[700] as string),
              },
            ]}
            numberOfLines={1}>
            {progressDetailsLabel}
          </Text>
        ) : null}
        {progressShowsCurrentItem && progress?.currentItem ? (
          <Text
            style={[styles.progressItemText, { color: mutedForeground }]}
            numberOfLines={1}
            ellipsizeMode="middle">
            {progress.currentItem}
          </Text>
        ) : null}
        {syncState.canCancel && (
          <Button
            title={t('common.cancel')}
            onPress={cancelSync}
            variant="danger"
            size="medium"
          />
        )}
      </View>
    ) : null;

  return (
    <View style={shellStyle}>
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: colors.neutral.transparent },
        ]}
        edges={['top']}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: isDark
                ? (colors.neutral[900] as string)
                : (colors.neutral[50] as string),
              borderBottomColor: themeColors.divider as string,
            },
          ]}>
          <Text style={[styles.title, { color: titleColor }]}>
            {t('sync.title')}
          </Text>
        </View>

        <ScrollView
          style={styles.scrollTransparent}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <Text
            style={[
              styles.sectionTitle,
              styles.dataSectionHeading,
              { color: themeColors.onSurface as string },
            ]}>
            {t('sync.observationsSection')}
          </Text>
          <View style={styles.statusCardsContainer}>
            <TouchableOpacity
              style={[
                styles.card,
                styles.statusCard,
                {
                  borderColor: themeColors.divider as string,
                  backgroundColor: cardBg,
                },
                !syncState.isActive &&
                  (pendingObservations > 0 || pendingUploads.count > 0) && {
                    borderWidth: 2,
                    borderColor: themeColors.primaryLight,
                  },
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
                    isObservationSyncActive
                      ? 'sync'
                      : syncState.error
                        ? 'alert-circle'
                        : pendingObservations > 0 || pendingUploads.count > 0
                          ? 'clock-alert-outline'
                          : 'check-circle'
                  }
                  size={20}
                  color={observationStatusIconColor as string}
                />
                <Text
                  style={[
                    styles.statusCardTitle,
                    { color: themeColors.onSurface as string },
                  ]}>
                  {t('sync.status')}
                </Text>
              </View>
              <Text
                style={[
                  styles.statusCardValue,
                  { color: observationStatusColor as string },
                ]}>
                {observationStatus}
              </Text>
              {!syncState.isActive &&
                !syncState.error &&
                (pendingObservations > 0 || pendingUploads.count > 0) && (
                  <Text
                    style={[
                      styles.statusCardSubtext,
                      { color: themeColors.onSurface as string },
                    ]}>
                    {t('sync.tapToSync')}
                  </Text>
                )}
            </TouchableOpacity>

            <View
              style={[
                styles.card,
                styles.statusCard,
                {
                  borderColor: themeColors.divider as string,
                  backgroundColor: cardBg,
                },
              ]}>
              <View style={styles.statusCardHeader}>
                <Icon
                  name="clock-outline"
                  size={20}
                  color={themeColors.onSurface as string}
                />
                <Text
                  style={[
                    styles.statusCardTitle,
                    { color: themeColors.onSurface as string },
                  ]}>
                  {t('sync.lastSync')}
                </Text>
              </View>
              <Text
                style={[
                  styles.statusCardValue,
                  { color: themeColors.onSurface as string },
                ]}>
                {lastSync ? formatRelativeTime(lastSync) : t('sync.never')}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.card,
              styles.connectivityCard,
              {
                borderColor: themeColors.divider as string,
                backgroundColor: cardBg,
              },
            ]}>
            <View style={styles.statusCardHeader}>
              <Icon
                name="speedometer"
                size={20}
                color={themeColors.onSurface as string}
              />
              <Text
                style={[
                  styles.statusCardTitle,
                  { color: themeColors.onSurface as string },
                ]}>
                {t('sync.connectivity.title')}
              </Text>
            </View>
            <View style={styles.connectivityMeterRow}>
              <View style={styles.connectivityMeter}>
                {[0, 1, 2, 3, 4].map(index => {
                  const active = index < connectivityLevel;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.connectivityMeterSegment,
                        {
                          backgroundColor: active
                            ? (themeColors.primary as string)
                            : isDark
                              ? (colors.neutral[700] as string)
                              : (colors.neutral[200] as string),
                        },
                      ]}
                    />
                  );
                })}
              </View>
              <Text
                style={[
                  styles.connectivityLabel,
                  { color: themeColors.onSurface as string },
                ]}>
                {connectivityLabel}
              </Text>
            </View>
          </View>

          {(pendingObservations > 0 || pendingUploads.count > 0) && (
            <View
              style={[
                styles.card,
                styles.pendingSection,
                {
                  borderColor: themeColors.divider as string,
                  backgroundColor: cardBg,
                },
              ]}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: themeColors.onSurface as string },
                ]}>
                {t('sync.pendingItems')}
              </Text>
              {isReadOnly &&
                (pendingObservations > 0 || pendingUploads.count > 0) && (
                  <Text
                    style={[
                      styles.readOnlyHint,
                      { color: themeColors.onSurface as string },
                    ]}>
                    {t('sync.readOnlyHint')}
                  </Text>
                )}
              {pendingObservations > 0 && (
                <View style={styles.pendingItem}>
                  <Icon
                    name="clipboard-text-outline"
                    size={20}
                    color={colors.semantic.warning[500] as unknown as string}
                  />
                  <View style={styles.pendingItemContent}>
                    <Text
                      style={[
                        styles.pendingItemLabel,
                        { color: themeColors.onSurface as string },
                      ]}>
                      {t('sync.observations')}
                    </Text>
                    <Text
                      style={[
                        styles.pendingItemValue,
                        { color: themeColors.onSurface as string },
                      ]}>
                      {t('sync.record', { count: pendingObservations })}
                    </Text>
                  </View>
                </View>
              )}
              {pendingUploads.count > 0 && (
                <View style={styles.pendingItem}>
                  <Icon
                    name="file-upload-outline"
                    size={20}
                    color={colors.semantic.warning[500] as unknown as string}
                  />
                  <View style={styles.pendingItemContent}>
                    <Text
                      style={[
                        styles.pendingItemLabel,
                        { color: themeColors.onSurface as string },
                      ]}>
                      {t('sync.attachments')}
                    </Text>
                    <Text
                      style={[
                        styles.pendingItemValue,
                        { color: themeColors.onSurface as string },
                      ]}>
                      {t('sync.file', {
                        count: pendingUploads.count,
                        size: pendingUploads.sizeMB.toFixed(2),
                      })}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {syncState.error && (
            <View
              style={[
                styles.card,
                styles.errorCard,
                {
                  borderColor: themeColors.divider as string,
                  backgroundColor: cardBg,
                },
              ]}>
              <View style={styles.errorHeader}>
                <Icon
                  name="alert-circle"
                  size={20}
                  color={colors.semantic.error.ios as string}
                />
                <Text style={styles.errorTitle}>{t('sync.error')}</Text>
              </View>
              <Text
                style={[
                  styles.errorText,
                  { color: themeColors.onSurface as string },
                ]}>
                {syncState.error}
              </Text>
              <Button
                title={t('sync.dismiss')}
                onPress={clearError}
                variant="danger"
                size="medium"
              />
            </View>
          )}

          {showObservationProgress && progressCard}

          <View style={styles.actionsSection}>
            <Button
              title={syncObservationsButtonLabel}
              onPress={handleSync}
              disabled={syncState.isActive}>
              {isSyncButtonActive ? (
                <ActivityIndicator
                  size="small"
                  color={themeColors.onPrimary as string}
                />
              ) : (
                <Icon
                  name="sync"
                  size={20}
                  color={themeColors.onPrimary as string}
                />
              )}
              <Text
                style={[
                  styles.actionButtonText,
                  { color: themeColors.onPrimary as string },
                ]}>
                {syncObservationsButtonLabel}
              </Text>
            </Button>
          </View>

          <View
            style={[
              styles.sectionDivider,
              { borderTopColor: themeColors.divider as string },
            ]}
          />

          <Text
            style={[
              styles.sectionTitle,
              styles.appBundleSectionHeading,
              { color: themeColors.onSurface as string },
            ]}>
            {t('sync.appBundle')}
          </Text>

          <View
            style={[
              styles.card,
              styles.appBundleCard,
              {
                borderWidth: odeBorderWidth.hairline,
                borderColor: themeColors.divider as string,
                backgroundColor: cardBg,
              },
            ]}>
            <Text
              style={[styles.appBundleSubtitle, { color: mutedForeground }]}>
              {t('sync.appBundleSubtitle')}
            </Text>

            <View style={styles.bundlePillActionsRow}>
              <View
                style={[
                  styles.bundleStatusPill,
                  { backgroundColor: bundleStatusPill.bg },
                ]}>
                <Icon
                  name={bundleStatusPill.icon}
                  size={18}
                  color={bundleStatusPill.iconColor}
                />
                <Text
                  style={[
                    styles.bundleStatusPillText,
                    { color: bundleStatusPill.textColor },
                  ]}>
                  {bundleStatusPill.label}
                </Text>
              </View>
              {updateAvailable && (
                <View style={styles.bundleUpdateButtonWrap}>
                  <Button
                    variant="primary"
                    size="small"
                    title={
                      isUpdateButtonActive
                        ? t('sync.updating')
                        : t('sync.update')
                    }
                    onPress={handleCustomAppUpdate}
                    disabled={syncState.isActive || !updateAvailable}
                    loading={isUpdateButtonActive}
                    active={
                      updateAvailable &&
                      !syncState.isActive &&
                      !isUpdateButtonActive
                    }
                  />
                </View>
              )}
            </View>

            <View
              style={[
                styles.bundleVersionSection,
                { borderTopColor: themeColors.divider as string },
              ]}>
              <Text
                style={[
                  styles.bundleVersionHeading,
                  { color: mutedForeground },
                ]}>
                {t('sync.version')}
              </Text>
              <View style={styles.bundleVersionRows}>
                <View style={styles.bundleVersionRow}>
                  <Text
                    style={[
                      styles.bundleVersionRole,
                      { color: themeColors.onSurface as string },
                    ]}>
                    {t('sync.local')}
                  </Text>
                  <Text
                    selectable
                    style={[
                      styles.bundleVersionValue,
                      { color: themeColors.onSurface as string },
                    ]}>
                    {appBundleVersion}
                  </Text>
                </View>
                <View style={styles.bundleVersionRow}>
                  <Text
                    style={[
                      styles.bundleVersionRole,
                      { color: themeColors.onSurface as string },
                    ]}>
                    {t('sync.server')}
                  </Text>
                  <Text
                    selectable
                    style={[
                      styles.bundleVersionValue,
                      { color: themeColors.onSurface as string },
                    ]}>
                    {serverBundleVersion}
                  </Text>
                </View>
              </View>
            </View>

            {!bundleVersionsKnown && (
              <Text
                style={[styles.appBundleFootnote, { color: mutedForeground }]}>
                {serverBundleVersion === 'Unknown' &&
                appBundleVersion === 'Unknown'
                  ? t('sync.bundleVersionUnavailable')
                  : serverBundleVersion === 'Unknown'
                    ? t('sync.serverBundleUnknown')
                    : t('sync.localBundleUnknown')}
              </Text>
            )}
          </View>

          {showBundleProgress && progressCard}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: odeSpacing.md,
    borderBottomWidth: odeBorderWidth.hairline,
    minHeight: odeScreenHeaderHeight,
    width: '100%',
    overflow: 'visible',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderRadius: 0,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: odeTypography.screenTitle,
    fontWeight: 'bold',
    marginBottom: odeSpacing.xs,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: odeTypography.bodySm,
    textAlign: 'left',
  },
  scrollTransparent: {
    backgroundColor: colors.neutral.transparent,
  },
  scrollContent: {
    padding: odeSpacing.md,
    paddingBottom: odeSpacing.xl,
  },
  card: {
    borderRadius: odeRadius.card,
    // Avoid double vertical gaps when parent containers also define margins.
    // Instead, each section/card controls its own spacing.
    marginBottom: 0,
    borderWidth: odeBorderWidth.hairline,
    padding: odeSpacing.md,
  },
  statusCardsContainer: {
    flexDirection: 'row',
    gap: odeSpacing.sm,
    marginBottom: odeSpacing.md,
  },
  statusCard: {
    flex: 1,
  },
  statusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.xs,
    marginBottom: odeSpacing.xs,
  },
  statusCardTitle: {
    fontSize: odeTypography.caption,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  statusCardValue: {
    fontSize: odeTypography.body,
    fontWeight: '600',
  },
  statusCardSubtext: {
    fontSize: odeTypography.caption,
    marginTop: odeSpacing.xxs,
  },
  connectivityCard: {
    marginBottom: odeSpacing.md,
  },
  connectivityMeterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.sm,
    marginTop: odeSpacing.xs,
  },
  connectivityMeter: {
    flex: 1,
    flexDirection: 'row',
    gap: odeSpacing.xxs,
  },
  connectivityMeterSegment: {
    flex: 1,
    height: 10,
    borderRadius: odeRadius.inner,
  },
  connectivityLabel: {
    fontSize: odeTypography.body,
    fontWeight: '600',
    minWidth: 128,
    textAlign: 'right',
  },
  pendingSection: {
    marginBottom: odeSpacing.md,
  },
  readOnlyHint: {
    fontSize: odeTypography.caption,
    marginBottom: odeSpacing.sm,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: odeTypography.sectionTitle,
    fontWeight: '600',
    marginBottom: odeSpacing.sm,
  },
  dataSectionHeading: {
    marginBottom: odeSpacing.sm,
  },
  appBundleSectionHeading: {
    marginBottom: odeSpacing.sm,
  },
  sectionDivider: {
    borderTopWidth: odeBorderWidth.hairline,
    marginVertical: odeSpacing.md,
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.sm,
    paddingVertical: odeSpacing.xs,
  },
  pendingItemContent: {
    flex: 1,
  },
  pendingItemLabel: {
    fontSize: odeTypography.bodySm,
    marginBottom: odeSpacing.xxs,
  },
  pendingItemValue: {
    fontSize: odeTypography.bodySm,
    fontWeight: '600',
  },
  appBundleCard: {
    marginBottom: odeSpacing.md,
    gap: odeSpacing.sm,
  },
  appBundleSubtitle: {
    fontSize: odeTypography.bodySm,
    lineHeight: 20,
  },
  bundlePillActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: odeSpacing.sm,
    flexWrap: 'wrap',
  },
  bundleStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
    gap: odeSpacing.xs,
    paddingVertical: odeSpacing.xs,
    paddingHorizontal: odeSpacing.md,
    borderRadius: 9999,
  },
  bundleStatusPillText: {
    fontSize: odeTypography.bodySm,
    fontWeight: '600',
    flexShrink: 1,
  },
  bundleVersionSection: {
    marginTop: odeSpacing.md,
    paddingTop: odeSpacing.md,
    borderTopWidth: odeBorderWidth.hairline,
  },
  bundleVersionHeading: {
    fontSize: odeTypography.caption,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: odeSpacing.xs,
  },
  bundleVersionRows: {
    gap: odeSpacing.xs,
  },
  bundleVersionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: odeSpacing.sm,
  },
  bundleVersionRole: {
    fontSize: odeTypography.bodySm,
    fontWeight: '700',
    minWidth: 56,
    lineHeight: 22,
  },
  bundleVersionValue: {
    flex: 1,
    fontSize: odeTypography.bodySm,
    fontWeight: '500',
    fontFamily: 'monospace',
    lineHeight: 22,
  },
  bundleUpdateButtonWrap: {
    flexShrink: 0,
    marginLeft: 'auto',
  },
  appBundleFootnote: {
    fontSize: odeTypography.caption,
    lineHeight: 18,
    marginTop: odeSpacing.xs,
  },
  progressCard: {
    marginBottom: odeSpacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: odeSpacing.xs,
    marginBottom: odeSpacing.sm,
  },
  progressTitle: {
    fontSize: odeTypography.sectionTitle,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: odeTypography.caption,
    textAlign: 'center',
    marginBottom: 4,
  },
  progressSubtext: {
    fontSize: odeTypography.caption,
    textAlign: 'center',
    marginBottom: 2,
  },
  progressItemText: {
    fontSize: odeTypography.caption,
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  errorCard: {
    marginBottom: odeSpacing.md,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: odeSpacing.xs,
    marginBottom: odeSpacing.sm,
  },
  errorTitle: {
    fontSize: odeTypography.sectionTitle,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.semantic.error[500] as unknown as string,
  },
  errorText: {
    fontSize: odeTypography.bodySm,
    textAlign: 'center',
    marginBottom: odeSpacing.sm,
  },
  actionsSection: {
    // Match the primary vertical gap used between the stacked cards/sections.
    gap: odeSpacing.md,
  },
  actionButtonText: {
    fontSize: odeTypography.body,
    fontWeight: '600',
  },
  secondaryButtonText: {},
});

export default SyncScreen;
