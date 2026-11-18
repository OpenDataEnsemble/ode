import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Images,
  Layer,
  Map,
  Marker,
  type CameraRef,
  type GeoJSONSourceRef,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import Icon from '@react-native-vector-icons/material-design-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../contexts/AppThemeContext';
import colors from '../../theme/colors';
import {
  odeSpacing,
  odeTypography,
  odeRadius,
  odeBorderWidth,
} from '../../theme/odeDesign';
import {
  boundsOfPoints,
  framingPoints,
  type ObservationMapPoint,
} from '../../database/observationMapQuery';
import {
  clusterBadgeExpression,
  colorsByFormType,
  toFeatureCollection,
  CLUSTER_MAX_ZOOM,
  CLUSTER_RADIUS_PX,
  type PointProps,
} from '../../maps/observationClusters';
import { CLUSTER_BADGE_IMAGES } from '../../maps/clusterBadgeImages';
import type { Basemap } from '../../maps/basemap';
import { formatDateTimeShort } from '../../utils/dateUtils';

type Bounds = [number, number, number, number];

type Props = {
  points: ObservationMapPoint[];
  basemap: Basemap;
  formNames: Record<string, string>;
  /** Shown over the map when its background cannot load from the network. */
  offlineNotice: string | null;
  onOpenObservation: (observationId: string) => void;
  onOpenOfflineMaps: (viewBounds: Bounds | null) => void;
};

const FIT_PADDING = { top: 72, right: 48, bottom: 72, left: 48 };
const LEAF_LIST_LIMIT = 200;
const PENDING_OUTLINE = '#B45309';
const POINT_FILTER = ['!', ['has', 'point_count']];
const CLUSTER_FILTER = ['has', 'point_count'];

const ObservationMap: React.FC<Props> = ({
  points,
  basemap,
  formNames,
  offlineNotice,
  onOpenObservation,
  onOpenOfflineMaps,
}) => {
  const { t } = useTranslation();
  const { themeColors, resolvedMode } = useAppTheme();
  const isDark = resolvedMode === 'dark';
  const cameraRef = useRef<CameraRef>(null);
  const sourceRef = useRef<GeoJSONSourceRef>(null);
  const viewBounds = useRef<Bounds | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leafList, setLeafList] = useState<PointProps[] | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);

  const formColors = useMemo(
    () => colorsByFormType(points.map(p => p.formType)),
    [points],
  );
  const featureCollection = useMemo(
    () => toFeatureCollection(points, formColors),
    [points, formColors],
  );
  const pointsById = useMemo(() => {
    const byId = new globalThis.Map<string, ObservationMapPoint>();
    for (const p of points) byId.set(p.observationId, p);
    return byId;
  }, [points]);
  const fitBounds = useMemo(
    () => boundsOfPoints(framingPoints(points)),
    [points],
  );

  useEffect(() => {
    if (fitBounds) {
      cameraRef.current?.fitBounds(fitBounds, {
        padding: FIT_PADDING,
        duration: 0,
      });
    }
  }, [fitBounds]);

  const onSourcePress = useCallback(
    async (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
      const features = event.nativeEvent.features ?? [];
      const cluster = features.find(f => f.properties?.cluster);
      if (cluster && cluster.geometry.type === 'Point') {
        const clusterId = Number(cluster.properties?.cluster_id);
        const [longitude, latitude] = cluster.geometry.coordinates;
        try {
          const zoom =
            await sourceRef.current?.getClusterExpansionZoom(clusterId);
          if (zoom == null || zoom > CLUSTER_MAX_ZOOM) {
            const leaves =
              (await sourceRef.current?.getClusterLeaves(
                clusterId,
                LEAF_LIST_LIMIT,
                0,
              )) ?? [];
            setLeafList(leaves.map(leaf => leaf.properties as PointProps));
            return;
          }
          cameraRef.current?.easeTo({
            center: [longitude, latitude],
            zoom,
            duration: 350,
          });
        } catch {
          cameraRef.current?.easeTo({
            center: [longitude, latitude],
            zoom: CLUSTER_MAX_ZOOM,
            duration: 350,
          });
        }
        return;
      }
      const id = features[0]?.properties?.observationId;
      if (typeof id === 'string') {
        setSelectedId(id);
      }
    },
    [],
  );

  const onRecenter = useCallback(() => {
    if (fitBounds) {
      cameraRef.current?.fitBounds(fitBounds, {
        padding: FIT_PADDING,
        duration: 400,
      });
    }
  }, [fitBounds]);

  const selected = selectedId ? pointsById.get(selectedId) : undefined;
  const surface = themeColors.surface as string;
  const onSurface = themeColors.onSurface as string;
  const strongText = isDark
    ? (colors.neutral.white as string)
    : (colors.neutral[900] as string);
  const primary = themeColors.primary as string;
  const onPrimary = themeColors.onPrimary as string;
  const legendEntries = Object.entries(formColors);

  const initialViewState = fitBounds
    ? { bounds: fitBounds, padding: FIT_PADDING }
    : { center: [0, 15] as [number, number], zoom: 1.5 };

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={basemap.mapStyle}
        logo={false}
        attribution
        attributionPosition={{ bottom: 8, left: 8 }}
        compass
        compassHiddenFacingNorth
        scaleBar
        scaleBarPosition={{ bottom: 8, right: 8 }}
        touchPitch={false}
        onRegionDidChange={event => {
          viewBounds.current = event.nativeEvent.bounds as Bounds;
        }}
        onPress={() => setSelectedId(null)}>
        <Camera
          ref={cameraRef}
          initialViewState={initialViewState}
          maxZoom={20}
        />
        <Images images={CLUSTER_BADGE_IMAGES} />
        <GeoJSONSource
          ref={sourceRef}
          id="observation-points"
          data={featureCollection}
          cluster
          clusterRadius={CLUSTER_RADIUS_PX}
          clusterMaxZoom={CLUSTER_MAX_ZOOM}
          onPress={onSourcePress}
          hitbox={{ top: 12, right: 12, bottom: 12, left: 12 }}>
          <Layer
            id="observation-clusters"
            type="circle"
            filter={CLUSTER_FILTER as never}
            paint={{
              'circle-color': primary,
              'circle-radius': [
                'step',
                ['get', 'point_count'],
                17,
                10,
                20,
                100,
                24,
                1000,
                28,
              ],
              'circle-stroke-width': 3,
              'circle-stroke-color': 'rgba(255,255,255,0.9)',
            }}
          />
          <Layer
            id="observation-cluster-counts"
            type="symbol"
            filter={CLUSTER_FILTER as never}
            layout={{
              'icon-image': clusterBadgeExpression() as never,
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            }}
          />
          <Layer
            id="observation-point-halo"
            type="circle"
            filter={POINT_FILTER as never}
            paint={{
              'circle-radius': 11,
              'circle-color': '#ffffff',
              'circle-opacity': 0.9,
            }}
          />
          <Layer
            id="observation-point"
            type="circle"
            filter={POINT_FILTER as never}
            paint={{
              'circle-radius': 8,
              'circle-color': ['get', 'color'],
              'circle-stroke-width': ['case', ['get', 'synced'], 0, 2.5],
              'circle-stroke-color': PENDING_OUTLINE,
            }}
          />
        </GeoJSONSource>
        {selected ? (
          <Marker
            id="selected-observation"
            lngLat={[selected.longitude, selected.latitude]}
            anchor="center">
            <View
              pointerEvents="none"
              style={[styles.selectedRing, { borderColor: primary }]}
            />
          </Marker>
        ) : null}
      </Map>

      <View style={styles.topControls} pointerEvents="box-none">
        <View style={styles.topLeft} pointerEvents="box-none">
          <Pressable
            onPress={() => setLegendOpen(open => !open)}
            style={[styles.chip, { backgroundColor: surface }]}
            accessibilityRole="button"
            accessibilityLabel={t('observations.map.legend')}>
            <Icon name="format-list-bulleted" size={16} color={strongText} />
            <Text style={[styles.chipText, { color: strongText }]}>
              {t('observations.map.legend')}
            </Text>
          </Pressable>
          {offlineNotice ? (
            <View style={[styles.offline, { backgroundColor: surface }]}>
              <Icon name="cloud-off-outline" size={16} color={onSurface} />
              <Text style={[styles.offlineText, { color: strongText }]}>
                {offlineNotice}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.topRight}>
          <Pressable
            onPress={onRecenter}
            style={[styles.iconButton, { backgroundColor: surface }]}
            accessibilityRole="button"
            accessibilityLabel={t('observations.map.fitAll')}>
            <Icon name="fit-to-screen-outline" size={22} color={strongText} />
          </Pressable>
          <Pressable
            onPress={() => onOpenOfflineMaps(viewBounds.current)}
            style={[styles.iconButton, { backgroundColor: surface }]}
            accessibilityRole="button"
            accessibilityLabel={t('offlineMaps.title')}>
            <Icon name="download-circle-outline" size={22} color={strongText} />
          </Pressable>
        </View>
      </View>

      {legendOpen ? (
        <View
          style={[
            styles.legend,
            { backgroundColor: surface, borderColor: themeColors.divider },
          ]}>
          {legendEntries.map(([formType, color]) => (
            <View key={formType} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text
                style={[styles.legendText, { color: strongText }]}
                numberOfLines={1}>
                {formNames[formType] ?? formType}
              </Text>
            </View>
          ))}
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, styles.legendPending]} />
            <Text style={[styles.legendText, { color: onSurface }]}>
              {t('observations.map.pendingOutline')}
            </Text>
          </View>
        </View>
      ) : null}

      {selected ? (
        <View
          style={[
            styles.card,
            { backgroundColor: surface, borderColor: themeColors.divider },
          ]}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: formColors[selected.formType] },
              ]}
            />
            <Text
              style={[styles.cardTitle, { color: strongText }]}
              numberOfLines={1}>
              {formNames[selected.formType] ?? selected.formType}
            </Text>
            <Pressable
              onPress={() => setSelectedId(null)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}>
              <Icon name="close" size={20} color={onSurface} />
            </Pressable>
          </View>
          <Text style={[styles.cardMeta, { color: onSurface }]}>
            {formatDateTimeShort(selected.createdAt)}
            {'  ·  '}
            <Text
              style={{
                color: selected.synced
                  ? (themeColors.success as string)
                  : (themeColors.warning as string),
              }}>
              {selected.synced ? t('filters.synced') : t('filters.pending')}
            </Text>
            {selected.accuracy != null
              ? `  ·  ±${Math.round(selected.accuracy)} m`
              : ''}
          </Text>
          <Pressable
            onPress={() => onOpenObservation(selected.observationId)}
            style={[styles.openButton, { backgroundColor: primary }]}
            accessibilityRole="button">
            <Text style={[styles.openButtonText, { color: onPrimary }]}>
              {t('observations.map.open')}
            </Text>
            <Icon name="chevron-right" size={18} color={onPrimary} />
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={leafList != null}
        transparent
        animationType="fade"
        onRequestClose={() => setLeafList(null)}>
        <Pressable style={styles.backdrop} onPress={() => setLeafList(null)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: surface }]}
            onPress={() => undefined}>
            <Text style={[styles.sheetTitle, { color: strongText }]}>
              {t('observations.map.samePlace', {
                count: leafList?.length ?? 0,
              })}
            </Text>
            <ScrollView style={styles.sheetList}>
              {(leafList ?? []).map(leaf => {
                const point = pointsById.get(leaf.observationId);
                return (
                  <Pressable
                    key={leaf.observationId}
                    style={[
                      styles.sheetRow,
                      { borderBottomColor: themeColors.divider },
                    ]}
                    onPress={() => {
                      setLeafList(null);
                      onOpenObservation(leaf.observationId);
                    }}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: leaf.color },
                      ]}
                    />
                    <View style={styles.sheetRowText}>
                      <Text
                        style={[styles.legendText, { color: strongText }]}
                        numberOfLines={1}>
                        {formNames[leaf.formType] ?? leaf.formType}
                      </Text>
                      {point ? (
                        <Text
                          style={[styles.cardMeta, { color: onSurface }]}
                          numberOfLines={1}>
                          {formatDateTimeShort(point.createdAt)}
                          {'  ·  '}
                          {leaf.synced
                            ? t('filters.synced')
                            : t('filters.pending')}
                        </Text>
                      ) : null}
                    </View>
                    <Icon name="chevron-right" size={20} color={onSurface} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  selectedRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
  },
  topControls: {
    position: 'absolute',
    top: odeSpacing.sm,
    left: odeSpacing.sm,
    right: odeSpacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: odeSpacing.xs,
  },
  topLeft: {
    flex: 1,
    alignItems: 'flex-start',
    gap: odeSpacing.xs,
  },
  topRight: {
    gap: odeSpacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.xxs,
    paddingHorizontal: odeSpacing.sm,
    paddingVertical: odeSpacing.xs,
    borderRadius: 20,
    elevation: 3,
  },
  chipText: {
    fontSize: odeTypography.caption,
    fontWeight: '600',
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.xs,
    paddingHorizontal: odeSpacing.sm,
    paddingVertical: odeSpacing.xs,
    borderRadius: odeRadius.inner,
    elevation: 3,
    maxWidth: '100%',
  },
  offlineText: {
    flexShrink: 1,
    fontSize: odeTypography.caption,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  legend: {
    position: 'absolute',
    top: 56,
    left: odeSpacing.sm,
    maxWidth: '70%',
    padding: odeSpacing.sm,
    borderRadius: odeRadius.inner,
    borderWidth: odeBorderWidth.hairline,
    gap: odeSpacing.xxs,
    elevation: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.xs,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendPending: {
    backgroundColor: 'transparent',
    borderWidth: 2.5,
    borderColor: PENDING_OUTLINE,
  },
  legendText: {
    fontSize: odeTypography.bodySm,
    flexShrink: 1,
  },
  card: {
    position: 'absolute',
    left: odeSpacing.sm,
    right: odeSpacing.sm,
    bottom: odeSpacing.xl,
    padding: odeSpacing.md,
    borderRadius: odeRadius.card,
    borderWidth: odeBorderWidth.hairline,
    gap: odeSpacing.xs,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.xs,
  },
  cardTitle: {
    flex: 1,
    fontSize: odeTypography.body,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: odeTypography.caption,
  },
  openButton: {
    marginTop: odeSpacing.xxs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: odeSpacing.xxs,
    paddingVertical: odeSpacing.sm,
    borderRadius: odeRadius.inner,
  },
  openButtonText: {
    fontSize: odeTypography.bodySm,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '60%',
    borderTopLeftRadius: odeRadius.card,
    borderTopRightRadius: odeRadius.card,
    paddingTop: odeSpacing.md,
    paddingBottom: odeSpacing.lg,
  },
  sheetTitle: {
    fontSize: odeTypography.body,
    fontWeight: '700',
    paddingHorizontal: odeSpacing.md,
    paddingBottom: odeSpacing.sm,
  },
  sheetList: {
    flexGrow: 0,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.sm,
    paddingHorizontal: odeSpacing.md,
    paddingVertical: odeSpacing.sm,
    borderBottomWidth: odeBorderWidth.hairline,
  },
  sheetRowText: {
    flex: 1,
  },
});

export default ObservationMap;
