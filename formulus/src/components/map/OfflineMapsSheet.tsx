import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import Icon from '@react-native-vector-icons/material-design-icons';
import { useTranslation } from 'react-i18next';
import type { OfflinePackStatus } from '@maplibre/maplibre-react-native';
import { useAppTheme } from '../../contexts/AppThemeContext';
import colors from '../../theme/colors';
import {
  odeSpacing,
  odeTypography,
  odeRadius,
  odeBorderWidth,
} from '../../theme/odeDesign';
import { padBounds, type Basemap } from '../../maps/basemap';
import {
  deleteOfflineArea,
  downloadOfflineArea,
  estimateAreaTiles,
  listOfflineAreas,
  resumeOfflineArea,
  unwatchOfflineArea,
  watchOfflineArea,
  OFFLINE_PACK_TILE_LIMIT,
  type OfflineArea,
} from '../../maps/OfflineMapsService';
import { formatDateTimeShort } from '../../utils/dateUtils';
import { logger } from '../../diagnostics/logger';

type Bounds = [number, number, number, number];

type Props = {
  visible: boolean;
  onClose: () => void;
  basemap: Basemap;
  /** False when the map's tile source cannot be reached right now. */
  online: boolean;
  /** Bounds framing the observations currently on the map. */
  observationsBounds: Bounds | null;
  /** Bounds of what the map currently shows. */
  viewBounds: Bounds | null;
};

/** Margin around the observations so the edge of the work area stays usable. */
const OBSERVATION_AREA_PADDING_KM = 1;
/** Rough average tile size, for the estimate shown before a download. */
const ESTIMATED_BYTES_PER_TILE = 18 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isComplete(status: OfflinePackStatus | null): boolean {
  return status?.state === 'complete' || (status?.percentage ?? 0) >= 100;
}

const OfflineMapsSheet: React.FC<Props> = ({
  visible,
  onClose,
  basemap,
  online,
  observationsBounds,
  viewBounds,
}) => {
  const { t } = useTranslation();
  const { themeColors, resolvedMode } = useAppTheme();
  const isDark = resolvedMode === 'dark';
  const strongText = isDark
    ? (colors.neutral.white as string)
    : (colors.neutral[900] as string);
  const onSurface = themeColors.onSurface as string;
  const primary = themeColors.primary as string;
  const onPrimary = themeColors.onPrimary as string;

  const [areas, setAreas] = useState<OfflineArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const watched = useRef(new Set<string>());

  const updateStatus = useCallback((status: OfflinePackStatus) => {
    setAreas(current =>
      current.map(area => (area.id === status.id ? { ...area, status } : area)),
    );
  }, []);

  const reportError = useCallback((message: string) => {
    setError(message);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listOfflineAreas();
      setAreas(list);
      for (const area of list) {
        if (!isComplete(area.status) && !watched.current.has(area.id)) {
          watched.current.add(area.id);
          await watchOfflineArea(area.id, updateStatus, reportError);
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('offlineMaps.loadFailed');
      logger.warn('map', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [reportError, t, updateStatus]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setError(null);
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, refresh]);

  useEffect(() => {
    const ids = watched.current;
    return () => {
      ids.forEach(id => unwatchOfflineArea(id));
      ids.clear();
    };
  }, []);

  const startDownload = useCallback(
    async (kind: 'observations' | 'view', bounds: Bounds) => {
      if (!basemap.downloadStyle) return;
      setError(null);
      setBusyId(kind);
      try {
        const stamp = formatDateTimeShort(new Date());
        const name =
          kind === 'observations'
            ? t('offlineMaps.observationsAreaName', { date: stamp })
            : t('offlineMaps.viewAreaName', { date: stamp });
        const id = await downloadOfflineArea({
          name,
          bounds,
          mapStyle: basemap.downloadStyle,
          maxZoom: basemap.offlineMaxZoom,
          onProgress: updateStatus,
          onError: reportError,
        });
        watched.current.add(id);
        await refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t('offlineMaps.downloadFailed'),
        );
      } finally {
        setBusyId(null);
      }
    },
    [basemap, refresh, reportError, t, updateStatus],
  );

  const removeArea = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        watched.current.delete(id);
        await deleteOfflineArea(id);
        setAreas(current => current.filter(area => area.id !== id));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t('offlineMaps.deleteFailed'),
        );
      } finally {
        setBusyId(null);
      }
    },
    [t],
  );

  const resumeArea = useCallback(
    async (id: string) => {
      try {
        if (!watched.current.has(id)) {
          watched.current.add(id);
          await watchOfflineArea(id, updateStatus, reportError);
        }
        await resumeOfflineArea(id);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t('offlineMaps.downloadFailed'),
        );
      }
    },
    [reportError, t, updateStatus],
  );

  const renderDownloadOption = (
    kind: 'observations' | 'view',
    icon: React.ComponentProps<typeof Icon>['name'],
    label: string,
    rawBounds: Bounds | null,
  ) => {
    if (!rawBounds) return null;
    const bounds =
      kind === 'observations'
        ? padBounds(rawBounds, OBSERVATION_AREA_PADDING_KM)
        : rawBounds;
    const tiles = estimateAreaTiles(bounds, basemap.offlineMaxZoom);
    const tooLarge = tiles > OFFLINE_PACK_TILE_LIMIT;
    const disabled = tooLarge || busyId != null;
    return (
      <Pressable
        key={kind}
        disabled={disabled}
        onPress={() => void startDownload(kind, bounds)}
        style={[
          styles.option,
          {
            borderColor: themeColors.divider,
            opacity: disabled ? 0.55 : 1,
          },
        ]}
        accessibilityRole="button">
        <Icon name={icon} size={24} color={primary} />
        <View style={styles.optionText}>
          <Text style={[styles.rowTitle, { color: strongText }]}>{label}</Text>
          <Text style={[styles.meta, { color: onSurface }]}>
            {tooLarge
              ? t('offlineMaps.tooLarge')
              : t('offlineMaps.estimate', {
                  size: formatBytes(tiles * ESTIMATED_BYTES_PER_TILE),
                })}
          </Text>
        </View>
        {busyId === kind ? (
          <ActivityIndicator color={primary} />
        ) : (
          <Icon name="download" size={22} color={onSurface} />
        )}
      </Pressable>
    );
  };

  const blockedMessage =
    basemap.downloadBlockedReason === 'osm-policy'
      ? t('offlineMaps.blockedOsm')
      : basemap.downloadBlockedReason === 'bundled'
        ? t('offlineMaps.blockedBundled')
        : basemap.downloadBlockedReason === 'not-enabled'
          ? t('offlineMaps.blockedNotEnabled')
          : !online
            ? t('offlineMaps.offlineNoDownload')
            : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: themeColors.surface }]}
          onPress={() => undefined}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: strongText }]}>
              {t('offlineMaps.title')}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}>
              <Icon name="close" size={22} color={onSurface} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={[styles.meta, { color: onSurface }]}>
              {t('offlineMaps.intro')}
            </Text>

            {basemap.bundledFiles.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: strongText }]}>
                  {t('offlineMaps.bundledTitle')}
                </Text>
                {basemap.bundledFiles.map(file => (
                  <View
                    key={file.path}
                    style={[
                      styles.row,
                      { borderBottomColor: themeColors.divider },
                    ]}>
                    <Icon name="map-check-outline" size={22} color={primary} />
                    <View style={styles.optionText}>
                      <Text style={[styles.rowTitle, { color: strongText }]}>
                        {file.name}
                      </Text>
                      <Text style={[styles.meta, { color: onSurface }]}>
                        {t('offlineMaps.bundledHint')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: strongText }]}>
                {t('offlineMaps.downloadTitle')}
              </Text>
              {blockedMessage ? (
                <View
                  style={[styles.notice, { borderColor: themeColors.divider }]}>
                  <Icon
                    name="information-outline"
                    size={20}
                    color={onSurface}
                  />
                  <Text
                    style={[styles.meta, styles.flex, { color: onSurface }]}>
                    {blockedMessage}
                  </Text>
                </View>
              ) : (
                <>
                  {renderDownloadOption(
                    'observations',
                    'map-marker-radius-outline',
                    t('offlineMaps.observationsArea'),
                    observationsBounds,
                  )}
                  {renderDownloadOption(
                    'view',
                    'crop-free',
                    t('offlineMaps.viewArea'),
                    viewBounds,
                  )}
                </>
              )}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: strongText }]}>
                {t('offlineMaps.savedTitle')}
              </Text>
              {loading && areas.length === 0 ? (
                <ActivityIndicator color={primary} />
              ) : areas.length === 0 ? (
                <Text style={[styles.meta, { color: onSurface }]}>
                  {t('offlineMaps.none')}
                </Text>
              ) : (
                areas.map(area => {
                  const status = area.status;
                  const done = isComplete(status);
                  const pct = Math.floor(status?.percentage ?? 0);
                  const active = status?.state === 'active';
                  return (
                    <View
                      key={area.id}
                      style={[
                        styles.row,
                        { borderBottomColor: themeColors.divider },
                      ]}>
                      <Icon
                        name={done ? 'map-check-outline' : 'map-clock-outline'}
                        size={22}
                        color={done ? primary : onSurface}
                      />
                      <View style={styles.optionText}>
                        <Text
                          style={[styles.rowTitle, { color: strongText }]}
                          numberOfLines={1}>
                          {area.metadata.name}
                        </Text>
                        <Text style={[styles.meta, { color: onSurface }]}>
                          {done
                            ? t('offlineMaps.ready', {
                                size: formatBytes(
                                  status?.completedResourceSize ?? 0,
                                ),
                              })
                            : active
                              ? t('offlineMaps.downloading', { percent: pct })
                              : t('offlineMaps.paused', { percent: pct })}
                        </Text>
                        {!done ? (
                          <View
                            style={[
                              styles.progressTrack,
                              { backgroundColor: themeColors.divider },
                            ]}>
                            <View
                              style={[
                                styles.progressFill,
                                {
                                  width: `${Math.min(100, pct)}%`,
                                  backgroundColor: primary,
                                },
                              ]}
                            />
                          </View>
                        ) : null}
                      </View>
                      {!done && !active && online ? (
                        <Pressable
                          onPress={() => void resumeArea(area.id)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={t('offlineMaps.resume')}>
                          <Icon
                            name="play-circle-outline"
                            size={24}
                            color={primary}
                          />
                        </Pressable>
                      ) : null}
                      {busyId === area.id ? (
                        <ActivityIndicator color={primary} />
                      ) : (
                        <Pressable
                          onPress={() => void removeArea(area.id)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={t('common.delete')}>
                          <Icon
                            name="trash-can-outline"
                            size={22}
                            color={themeColors.error as string}
                          />
                        </Pressable>
                      )}
                    </View>
                  );
                })
              )}
            </View>

            {error ? (
              <Text
                style={[styles.meta, { color: themeColors.error as string }]}>
                {error}
              </Text>
            ) : null}
          </ScrollView>
          <Pressable
            onPress={onClose}
            style={[styles.doneButton, { backgroundColor: primary }]}
            accessibilityRole="button">
            <Text style={[styles.doneText, { color: onPrimary }]}>
              {t('common.close')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: odeRadius.card,
    borderTopRightRadius: odeRadius.card,
    paddingBottom: odeSpacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: odeSpacing.md,
    paddingTop: odeSpacing.md,
    paddingBottom: odeSpacing.xs,
  },
  title: {
    fontSize: odeTypography.sectionTitle,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: odeSpacing.md,
    paddingBottom: odeSpacing.md,
    gap: odeSpacing.md,
  },
  section: {
    gap: odeSpacing.xs,
  },
  sectionTitle: {
    fontSize: odeTypography.bodySm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.sm,
    padding: odeSpacing.sm,
    borderRadius: odeRadius.inner,
    borderWidth: odeBorderWidth.hairline,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.sm,
    paddingVertical: odeSpacing.sm,
    borderBottomWidth: odeBorderWidth.hairline,
  },
  rowTitle: {
    fontSize: odeTypography.bodySm,
    fontWeight: '600',
  },
  meta: {
    fontSize: odeTypography.caption,
  },
  flex: {
    flex: 1,
  },
  notice: {
    flexDirection: 'row',
    gap: odeSpacing.xs,
    padding: odeSpacing.sm,
    borderRadius: odeRadius.inner,
    borderWidth: odeBorderWidth.hairline,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: 4,
  },
  doneButton: {
    marginHorizontal: odeSpacing.md,
    paddingVertical: odeSpacing.sm,
    borderRadius: odeRadius.inner,
    alignItems: 'center',
  },
  doneText: {
    fontSize: odeTypography.body,
    fontWeight: '700',
  },
});

export default OfflineMapsSheet;
