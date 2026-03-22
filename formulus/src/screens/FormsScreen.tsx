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
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/material-design-icons';
import { useForms } from '../hooks/useForms';
import { FormCard, EmptyState, Input as ODEInput } from '../components/common';
import { openFormplayerFromNative } from '../webview/FormulusMessageHandlers';
import { useFocusEffect } from '@react-navigation/native';
import colors from '../theme/colors';
import { FormSpec } from '../services';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useScreenShellStyle } from '../hooks/useScreenShellStyle';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeRadius,
  odeScreenHeaderHeight,
} from '../theme/odeDesign';

const FormsScreen: React.FC = () => {
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
  const { forms, loading, error, refresh, getObservationCount } = useForms();
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);

  const filteredForms = useMemo(() => {
    if (!searchQuery.trim()) return forms;
    const q = searchQuery.trim().toLowerCase();
    return forms.filter(form => form.name.toLowerCase().includes(q));
  }, [forms, searchQuery]);

  const showSubtitle = forms.length > 0;

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const shouldShowSearch = forms.length > 4;

  React.useEffect(() => {
    if (!shouldShowSearch) {
      setShowSearch(false);
      setSearchQuery('');
    }
  }, [shouldShowSearch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleFormPress = async (formId: string) => {
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
      Alert.alert('Error', 'Failed to open form. Please try again.');
    }
  };

  const renderForm = ({ item }: { item: FormSpec }) => {
    const observationCount = getObservationCount(item.id);
    return (
      <FormCard
        form={item}
        observationCount={observationCount}
        onPress={() => handleFormPress(item.id)}
      />
    );
  };

  if (loading && forms.length === 0) {
    return (
      <View style={shellStyle}>
        <SafeAreaView
          style={[styles.container, { backgroundColor: 'transparent' }]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text
              style={[styles.loadingText, { color: themeColors.onBackground }]}>
              Loading forms...
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
          style={[styles.container, { backgroundColor: 'transparent' }]}>
          <EmptyState
            icon="alert-circle-outline"
            title="Error Loading Forms"
            message={error}
            actionLabel="Retry"
            onAction={refresh}
          />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={shellStyle}>
      <SafeAreaView
        style={[styles.container, { backgroundColor: 'transparent' }]}
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
              Forms
            </Text>
            {showSubtitle && (
              <Text style={[styles.subtitle, { color: themeColors.onSurface }]}>
                {filteredForms.length} form
                {filteredForms.length !== 1 ? 's' : ''} available
              </Text>
            )}
          </View>
          {shouldShowSearch ? (
            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => setShowSearch(!showSearch)}>
              <Icon
                name={showSearch ? 'close' : 'magnify'}
                size={24}
                color={themeColors.primary}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.searchButtonPlaceholder} />
          )}
        </View>

        {shouldShowSearch && showSearch && (
          <View style={searchContainerStyle}>
            <Icon
              name="magnify"
              size={20}
              color={themeColors.onSurface}
              style={styles.searchIcon}
            />
            <ODEInput
              placeholder="Search forms..."
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

        {forms.length === 0 ? (
          <EmptyState
            icon="file-document-outline"
            title="No Forms Available"
            message="No forms have been downloaded yet. Go to the Sync screen to download forms from the server."
          />
        ) : filteredForms.length === 0 ? (
          <EmptyState
            icon="file-document-outline"
            title={searchQuery ? 'No Forms Found' : 'No Forms Available'}
            message={
              searchQuery
                ? 'Try adjusting your search.'
                : 'No forms have been downloaded yet. Go to the Sync screen to download forms from the server.'
            }
          />
        ) : (
          <FlatList
            style={styles.listTransparent}
            data={filteredForms}
            renderItem={renderForm}
            keyExtractor={item => item.id}
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
    backgroundColor: 'transparent',
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

export default FormsScreen;
