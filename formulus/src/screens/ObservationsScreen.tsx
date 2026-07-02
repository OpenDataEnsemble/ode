import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Input as ODEInput } from '../components/common';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/material-design-icons';
import { useObservations } from '../hooks/useObservations';
import {
  ObservationCard,
  EmptyState,
  FormTypeSelector,
  SyncStatusButtons,
  SyncStatus,
} from '../components/common';
import { isObservationFullySynced } from '../utils/observationSyncStatus';
import { openFormplayerFromNative } from '../webview/FormulusMessageHandlers';
import { FormService } from '../services/FormService';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MainAppStackParamList } from '../types/NavigationTypes';
import { Observation } from '../database/models/Observation';
import colors from '../theme/colors';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useConfirmModal } from '../contexts/ConfirmModalContext';
import { useScreenShellStyle } from '../hooks/useScreenShellStyle';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeRadius,
  odeScreenHeaderHeight,
} from '../theme/odeDesign';
import { useTranslation } from 'react-i18next';

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
  const _headerBg = isDark
    ? (colors.neutral[900] as string)
    : (colors.neutral[50] as string);
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
  const observationsHook = useObservations();
  const {
    filteredAndSorted,
    loading,
    error,
    refresh,
    searchQuery,
    setSearchQuery,
  } = observationsHook;
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [formNames, setFormNames] = useState<Record<string, string>>({});
  const [formTypes, setFormTypes] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [selectedFormType, setSelectedFormType] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('all');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const { showConfirm } = useConfirmModal();

  useFocusEffect(
    React.useCallback(() => {
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
      loadFormData();
      refresh();
    }, [refresh]),
  );

  const finalFiltered = useMemo(() => {
    let filtered = filteredAndSorted;

    if (selectedFormType) {
      filtered = filtered.filter(obs => obs.formType === selectedFormType);
    }

    if (syncStatus !== 'all') {
      filtered = filtered.filter(obs => {
        const synced = isObservationFullySynced(obs);
        return syncStatus === 'synced' ? synced : !synced;
      });
    }

    return filtered;
  }, [filteredAndSorted, selectedFormType, syncStatus]);

  const showSubtitle = finalFiltered.length > 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleObservationPress = (observation: Observation) => {
    navigation.navigate('ObservationDetail', {
      observationId: observation.observationId,
    });
  };

  const handleEditObservation = async (observation: Observation) => {
    try {
      const result = await openFormplayerFromNative(
        observation.formType,
        {},
        typeof observation.data === 'string'
          ? JSON.parse(observation.data)
          : observation.data,
        observation.observationId,
      );
      if (
        result.status === 'form_submitted' ||
        result.status === 'form_updated'
      ) {
        await refresh();
      }
    } catch (err) {
      console.error('Error editing observation:', err);
      Alert.alert(t('common.error'), t('observations.editError'));
    }
  };

  const handleDeleteObservation = async (observation: Observation) => {
    showConfirm({
      title: t('observations.deleteTitle'),
      message: t('observations.deleteMessage'),
      buttons: [
        { text: t('common.cancel'), onPress: () => {}, variant: 'tertiary' },
        {
          text: t('observations.delete'),
          variant: 'danger',
          onPress: async () => {
            try {
              const formService = await FormService.getInstance();
              await formService.deleteObservation(observation.observationId);
              await refresh();
            } catch (err) {
              console.error('Error deleting observation:', err);
              Alert.alert(t('common.error'), t('observations.deleteError'));
            }
          },
        },
      ],
    });
  };

  const renderObservation = ({ item }: { item: Observation }) => {
    return (
      <ObservationCard
        observation={item}
        formName={formNames[item.formType] || item.formType}
        onPress={() => handleObservationPress(item)}
        onEdit={() => handleEditObservation(item)}
        onDelete={() => handleDeleteObservation(item)}
      />
    );
  };

  if (loading && filteredAndSorted.length === 0) {
    return (
      <View style={shellStyle}>
        <SafeAreaView
          style={[
            styles.container,
            { backgroundColor: colors.neutral.transparent },
          ]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text
              style={[styles.loadingText, { color: themeColors.onBackground }]}>
              {t('observations.loading')}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error && filteredAndSorted.length === 0) {
    return (
      <View style={shellStyle}>
        <SafeAreaView
          style={[
            styles.container,
            { backgroundColor: colors.neutral.transparent },
          ]}>
          <EmptyState
            icon="alert-circle-outline"
            title={t('observations.errorTitle')}
            message={error}
            actionLabel={t('common.retry')}
            onAction={refresh}
          />
        </SafeAreaView>
      </View>
    );
  }

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
                {t('observations.count', { count: finalFiltered.length })}
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
          </View>
        </View>

        {finalFiltered.length === 0 ? (
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
          <FlatList
            style={styles.listTransparent}
            data={finalFiltered}
            renderItem={renderObservation}
            keyExtractor={item => item.observationId}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listTransparent: {
    backgroundColor: colors.neutral.transparent,
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
  listContent: {
    // Same gap as between cards: paddingTop + first card marginTop = 16.
    paddingVertical: odeSpacing.xs,
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
