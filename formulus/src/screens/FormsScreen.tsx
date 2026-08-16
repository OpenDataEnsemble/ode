import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/material-design-icons';
import { useForms } from '../hooks/useForms';
import {
  FormListTable,
  EmptyState,
  Input as ODEInput,
} from '../components/common';
import { openFormplayerFromNative } from '../webview/FormulusMessageHandlers';
import { useFocusEffect } from '@react-navigation/native';
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

const FormsScreen: React.FC = () => {
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
  const headerBg = isDark
    ? (colors.neutral[900] as string)
    : (colors.neutral[50] as string);
  const searchContainerStyle = [
    styles.searchContainer,
    {
      backgroundColor: themeColors.surface as string,
      borderColor: themeColors.divider as string,
    },
  ];
  const { forms, loading, error, refresh, observationCounts } = useForms();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);

  const shouldShowSearch = forms.length > 4;
  const effectiveSearchQuery = shouldShowSearch ? searchQuery : '';
  const effectiveShowSearch = shouldShowSearch && showSearch;

  const filteredForms = useMemo(() => {
    if (!effectiveSearchQuery.trim()) return forms;
    const q = effectiveSearchQuery.trim().toLowerCase();
    return forms.filter(form => form.name.toLowerCase().includes(q));
  }, [forms, effectiveSearchQuery]);

  const showSubtitle = forms.length > 0;

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleCreate = useCallback(
    async (formId: string) => {
      try {
        const result = await openFormplayerFromNative(formId, {}, {});
        if (
          result.status === 'form_submitted' ||
          result.status === 'form_updated'
        ) {
          await refresh();
        }
      } catch (err) {
        console.error('Error opening form:', err);
        Alert.alert(t('common.error'), t('forms.openError'));
      }
    },
    [refresh, t],
  );

  if (loading && forms.length === 0) {
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
              {t('forms.loading')}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error && forms.length === 0) {
    return (
      <View style={shellStyle}>
        <SafeAreaView
          style={[
            styles.container,
            { backgroundColor: colors.neutral.transparent },
          ]}>
          <EmptyState
            icon="alert-circle-outline"
            title={t('forms.errorTitle')}
            message={error}
            actionLabel={t('forms.retry')}
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
              backgroundColor: headerBg,
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
              {t('forms.title')}
            </Text>
            {showSubtitle && (
              <Text style={[styles.subtitle, { color: themeColors.onSurface }]}>
                {t('forms.available', { count: filteredForms.length })}
              </Text>
            )}
          </View>
          {shouldShowSearch ? (
            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => setShowSearch(!effectiveShowSearch)}>
              <Icon
                name={effectiveShowSearch ? 'close' : 'magnify'}
                size={24}
                color={themeColors.primary}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.searchButtonPlaceholder} />
          )}
        </View>

        {effectiveShowSearch && (
          <View style={searchContainerStyle}>
            <Icon
              name="magnify"
              size={20}
              color={themeColors.onSurface}
              style={styles.searchIcon}
            />
            <ODEInput
              placeholder={t('forms.searchPlaceholder')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
            {effectiveSearchQuery.length > 0 && (
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

        {forms.length === 0 ? (
          <EmptyState
            icon="file-document-outline"
            title={t('forms.emptyTitle')}
            message={t('forms.emptyMessage')}
          />
        ) : filteredForms.length === 0 ? (
          <EmptyState
            icon="file-document-outline"
            title={
              effectiveSearchQuery
                ? t('forms.emptySearchTitle')
                : t('forms.emptyTitle')
            }
            message={
              effectiveSearchQuery
                ? t('forms.emptySearchMessage')
                : t('forms.emptyMessage')
            }
          />
        ) : (
          <FormListTable
            forms={filteredForms}
            observationCounts={observationCounts}
            onCreate={handleCreate}
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
  searchButtonPlaceholder: {
    // Keep header spacing stable even when search is hidden.
    padding: odeSpacing.xxs,
    marginTop: odeSpacing.xxs,
    width: 24 + odeSpacing.xxs * 2,
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

export default FormsScreen;
