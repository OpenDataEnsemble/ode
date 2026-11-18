import React, {
  Suspense,
  lazy,
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
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Input as ODEInput } from '../components/common';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/material-design-icons';
import { useObservations } from '../hooks/useObservations';
import { useObservationMap } from '../hooks/useObservationMap';
import { boundsOfPoints, framingPoints } from '../database/observationMapQuery';
import {
  EmptyState,
  FormTypeSelector,
  SyncStatusButtons,
  ObservationListTable,
  ObservationPager,
} from '../components/common';
import { FormService } from '../services/FormService';
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MainAppStackParamList } from '../types/NavigationTypes';
import colors from '../theme/colors';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useScreenShellStyle } from '../hooks/useScreenShellStyle';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeRadius,
  odeScreenHeaderHeight,
} from '../theme/odeDesign';
import { useTranslation } from 'react-i18next';
import { logger } from '../diagnostics/logger';
import type { ObservationListRow } from '../database/observationListQuery';

type ViewMode = 'list' | 'map';

// The map engine loads only when someone opens the Map view.
const ObservationMap = lazy(() => import('../components/map/ObservationMap'));
const OfflineMapsSheet = lazy(
  () => import('../components/map/OfflineMapsSheet'),
);

type ObservationsScreenNavigationProp = StackNavigationProp<
  MainAppStackParamList,
  'ObservationDetail'
>;

const ObservationsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { themeColors, resolvedMode } = useAppTheme();
  const shellStyle = useScreenShellStyle();
  const isDark = resolvedMode === 'dark';
  const titleColor = isDark
    ? (themeColors.onSurface as string)
    : (colors.neutral[900] as string);
  const clearIconColor = isDark
    ? (colors.neutral[300] as string)
    : (colors.neutral[600] as string);
  const filtersContainerStyle = [
    styles.filtersContainer,
    {
      backgroundColor: themeColors.surface as string,
      borderColor: themeColors.divider as string,
      borderBottomColor: themeColors.divider as string,
    },
  ];
  const searchContainerStyle = [
    styles.searchContainer,
    {
      backgroundColor: themeColors.surface as string,
      borderColor: themeColors.divider as string,
    },
  ];
  const navigation = useNavigation<ObservationsScreenNavigationProp>();
  const {
    rows,
    total,
    totalPages,
    page,
    setPage,
    loading,
    error,
    refresh,
    searchQuery,
    setSearchQuery,
    selectedFormType,
    setSelectedFormType,
    syncStatus,
    setSyncStatus,
  } = useObservations();
  const [formNames, setFormNames] = useState<Record<string, string>>({});
  const [formTypes, setFormTypes] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [offlineSheet, setOfflineSheet] = useState<{
    viewBounds: [number, number, number, number] | null;
  } | null>(null);
  // The map holds GPU and tile memory: keep it mounted only while this screen
  // is visible (not under ObservationDetail or a form).
  const isFocused = useIsFocused();
  const mapActive = viewMode === 'map' && isFocused;
  const map = useObservationMap(mapActive, {
    formType: selectedFormType,
    syncStatus,
    search: searchQuery,
  });
  const observationsBounds = useMemo(
    () => boundsOfPoints(framingPoints(map.points)),
    [map.points],
  );
  const mapOfflineNotice =
    map.online !== false || !map.basemap
      ? null
      : map.basemap.usesBundledStyle || map.basemap.bundledFiles.length > 0
        ? t('observations.map.offlineWithStudyMaps')
        : t('observations.map.offlineNotice');
  const refreshRef = useRef(refresh);
  const skipFocusRefresh = useRef(true);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useFocusEffect(
    React.useCallback(() => {
      void logger.breadcrumb('screen', 'observations', {
        screen: 'Observations',
      });
      const loadFormData = async () => {
        try {
          const formService = await FormService.getInstance();
          const formSpecs = formService.getFormSpecs();
          const names: Record<string, string> = {};
          const types: { id: string; name: string }[] = [];
          formSpecs.forEach(form => {
            names[form.id] = form.name;
            types.push({ id: form.id, name: form.name });
          });
          setFormNames(names);
          setFormTypes(types);
        } catch (err) {
          console.error('Failed to load form data:', err);
        }
      };
      void loadFormData();
      // First focus: useObservations already loads. Later focuses (back from
      // detail) refresh without tying this effect to the loadPage identity.
      if (skipFocusRefresh.current) {
        skipFocusRefresh.current = false;
        return;
      }
      void refreshRef.current();
    }, []),
  );

  const showSubtitle = total > 0;

  const openObservation = useCallback(
    (observationId: string) => {
      navigation.navigate('ObservationDetail', { observationId });
    },
    [navigation],
  );

  const handleRowPress = useCallback(
    (row: ObservationListRow) => {
      navigation.navigate('ObservationDetail', {
        observationId: row.observationId,
      });
    },
    [navigation],
  );

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
          <View style={styles.headerLeft}>
            <Text
              style={[
                styles.title,
                {
                  color: titleColor,
                  marginBottom: showSubtitle ? 0 : odeSpacing.xs,
                },
              ]}>
              {t('observations.title')}
            </Text>
            {showSubtitle && (
              <Text style={[styles.subtitle, { color: themeColors.onSurface }]}>
                {t('observations.count', { count: total })}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setShowSearch(!showSearch)}>
            <Icon
              name={showSearch ? 'close' : 'magnify'}
              size={24}
              color={themeColors.primary}
            />
          </TouchableOpacity>
        </View>

        {showSearch && (
          <View style={searchContainerStyle}>
            <Icon
              name="magnify"
              size={20}
              color={themeColors.onSurface}
              style={styles.searchIcon}
            />
            <ODEInput
              placeholder={t('observations.searchPlaceholder')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearIconButton}
                hitSlop={8}>
                <Icon
                  name="close"
                  size={20}
                  color={clearIconColor}
                  style={styles.clearIcon}
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={filtersContainerStyle}>
          <View style={styles.filterRow}>
            <View style={styles.formSelectorStretch}>
              <FormTypeSelector
                options={formTypes}
                selectedId={selectedFormType}
                onSelect={setSelectedFormType}
                placeholder={t('observations.allForms')}
                style={{ alignSelf: 'stretch', maxWidth: undefined }}
              />
            </View>
          </View>
          <View style={styles.filterRow}>
            <SyncStatusButtons
              selectedStatus={syncStatus}
              onStatusChange={setSyncStatus}
              containerStyle={{ alignSelf: 'stretch', maxWidth: undefined }}
            />
            <View
              style={[
                styles.viewToggle,
                { borderColor: themeColors.primary as string },
              ]}
              accessibilityRole="tablist">
              {(['list', 'map'] as const).map(mode => {
                const active = viewMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setViewMode(mode)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={
                      mode === 'list'
                        ? t('observations.viewList')
                        : t('observations.viewMap')
                    }
                    style={[
                      styles.viewToggleButton,
                      active && {
                        backgroundColor: themeColors.primary as string,
                      },
                    ]}>
                    <Icon
                      name={
                        mode === 'list' ? 'format-list-bulleted' : 'map-outline'
                      }
                      size={20}
                      color={
                        active
                          ? (themeColors.onPrimary as string)
                          : (themeColors.primary as string)
                      }
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {viewMode === 'map' ? (
          <View style={styles.tableSection}>
            {map.points.length > 0 &&
            (map.withoutLocation > 0 || map.truncated) ? (
              <View
                style={[
                  styles.mapNotice,
                  {
                    backgroundColor: themeColors.surface as string,
                    borderBottomColor: themeColors.divider as string,
                  },
                ]}>
                <Icon
                  name="map-marker-off-outline"
                  size={16}
                  color={themeColors.onSurface as string}
                />
                <Text
                  style={[
                    styles.mapNoticeText,
                    { color: themeColors.onSurface as string },
                  ]}>
                  {map.truncated
                    ? t('observations.map.truncated', {
                        count: map.points.length,
                      })
                    : t('observations.map.withoutLocation', {
                        count: map.withoutLocation,
                        total: map.total,
                      })}
                </Text>
              </View>
            ) : null}
            {map.error && map.points.length === 0 ? (
              <EmptyState
                icon="alert-circle-outline"
                title={t('observations.map.errorTitle')}
                message={map.error}
                actionLabel={t('common.retry')}
                onAction={map.refresh}
              />
            ) : !map.basemap || (map.loading && map.points.length === 0) ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={themeColors.primary} />
                <Text
                  style={[
                    styles.loadingText,
                    { color: themeColors.onBackground },
                  ]}>
                  {t('observations.map.loading')}
                </Text>
              </View>
            ) : map.points.length === 0 ? (
              <EmptyState
                icon="map-marker-off-outline"
                title={t('observations.map.emptyTitle')}
                message={
                  map.total > 0
                    ? t('observations.map.emptyNoLocation', {
                        count: map.total,
                      })
                    : t('observations.emptyFoundMessage')
                }
              />
            ) : mapActive ? (
              <Suspense
                fallback={
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator
                      size="large"
                      color={themeColors.primary}
                    />
                  </View>
                }>
                <ObservationMap
                  points={map.points}
                  basemap={map.basemap}
                  formNames={formNames}
                  offlineNotice={mapOfflineNotice}
                  onOpenObservation={openObservation}
                  onOpenOfflineMaps={viewBounds =>
                    setOfflineSheet({ viewBounds })
                  }
                />
              </Suspense>
            ) : null}
            {map.basemap && offlineSheet != null ? (
              <Suspense fallback={null}>
                <OfflineMapsSheet
                  visible
                  onClose={() => setOfflineSheet(null)}
                  basemap={map.basemap}
                  online={map.online !== false}
                  observationsBounds={observationsBounds}
                  viewBounds={offlineSheet.viewBounds}
                />
              </Suspense>
            ) : null}
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text
              style={[styles.loadingText, { color: themeColors.onBackground }]}>
              {t('observations.loading')}
            </Text>
          </View>
        ) : error && rows.length === 0 ? (
          <EmptyState
            icon="alert-circle-outline"
            title={t('observations.errorTitle')}
            message={error}
            actionLabel={t('common.retry')}
            onAction={refresh}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="clipboard-text-outline"
            title={
              searchQuery || selectedFormType || syncStatus !== 'all'
                ? t('observations.emptyFound')
                : t('observations.emptyYet')
            }
            message={
              searchQuery || selectedFormType || syncStatus !== 'all'
                ? t('observations.emptyFoundMessage')
                : t('observations.emptyYetMessage')
            }
          />
        ) : (
          <View style={styles.tableSection}>
            <ObservationListTable
              rows={rows}
              formNames={formNames}
              onPressRow={handleRowPress}
            />
            <ObservationPager
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: odeSpacing.md,
    borderBottomWidth: odeBorderWidth.hairline,
    minHeight: odeScreenHeaderHeight,
    width: '100%',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderRadius: 0,
  },
  headerLeft: {
    flex: 1,
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
  searchButton: {
    padding: odeSpacing.xxs,
    marginTop: odeSpacing.xxs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: odeSpacing.lg,
    marginTop: odeSpacing.md,
    marginBottom: odeSpacing.xs,
    paddingHorizontal: odeSpacing.sm,
    borderRadius: odeRadius.inner,
    borderWidth: odeBorderWidth.hairline,
  },
  searchIcon: {
    marginRight: odeSpacing.xs,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  clearIconButton: {
    marginLeft: odeSpacing.xs,
  },
  clearIcon: {},
  filtersContainer: {
    padding: odeSpacing.md,
    borderBottomWidth: odeBorderWidth.hairline,
    overflow: 'hidden',
    gap: 12,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: odeSpacing.sm,
  },
  formSelectorStretch: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: 44,
  },
  viewToggle: {
    flexDirection: 'row',
    borderWidth: odeBorderWidth.hairline,
    borderRadius: odeRadius.inner,
    overflow: 'hidden',
  },
  viewToggleButton: {
    paddingHorizontal: odeSpacing.sm,
    minHeight: 40,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.xs,
    paddingHorizontal: odeSpacing.md,
    paddingVertical: odeSpacing.xs,
    borderBottomWidth: odeBorderWidth.hairline,
  },
  mapNoticeText: {
    flex: 1,
    fontSize: odeTypography.caption,
  },
  tableSection: {
    flex: 1,
    minHeight: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: odeSpacing.sm,
    fontSize: odeTypography.body,
  },
});

export default ObservationsScreen;
