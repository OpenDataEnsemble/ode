import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForms } from '../hooks/useForms';
import { FormCard, EmptyState } from '../components/common';
import { openFormplayerFromNative } from '../webview/FormulusMessageHandlers';
import { useFocusEffect } from '@react-navigation/native';
import colors from '../theme/colors';
import { FormSpec } from '../services';
import { useAppTheme } from '../contexts/AppThemeContext';
import BlurredScreenBackground from '../components/BlurredScreenBackground';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeRadius,
} from '../theme/odeDesign';

const FormsScreen: React.FC = () => {
  const { themeColors, resolvedMode } = useAppTheme();
  const isDark = resolvedMode === 'dark';
  const titleColor = isDark
    ? (themeColors.onSurface as string)
    : (colors.neutral[900] as string);
  const { forms, loading, error, refresh, getObservationCount } = useForms();
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

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
      <BlurredScreenBackground>
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
      </BlurredScreenBackground>
    );
  }

  if (error && forms.length === 0) {
    return (
      <BlurredScreenBackground>
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
      </BlurredScreenBackground>
    );
  }

  return (
    <BlurredScreenBackground>
      <SafeAreaView
        style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: isDark
                ? (colors.neutral[900] as string)
                : (colors.neutral[50] as string),
              borderWidth: 1,
              borderBottomWidth: 1,
              borderColor: themeColors.divider as string,
              borderBottomColor: themeColors.divider as string,
            },
          ]}>
          <Text style={[styles.title, { color: titleColor }]}>Forms</Text>
          {forms.length > 0 && (
            <Text style={[styles.subtitle, { color: themeColors.onSurface }]}>
              {forms.length} form{forms.length !== 1 ? 's' : ''} available
            </Text>
          )}
        </View>

        {forms.length === 0 ? (
          <EmptyState
            icon="file-document-outline"
            title="No Forms Available"
            message="No forms have been downloaded yet. Go to the Sync screen to download forms from the server."
          />
        ) : (
          <FlatList
            style={styles.listTransparent}
            data={forms}
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
    </BlurredScreenBackground>
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
    marginHorizontal: odeSpacing.sm,
    padding: odeSpacing.md,
    borderBottomWidth: odeBorderWidth.hairline,
    borderBottomLeftRadius: odeRadius.card,
    borderBottomRightRadius: odeRadius.card,
    overflow: 'hidden',
    alignItems: 'center',
  },
  title: {
    fontSize: odeTypography.screenTitle,
    fontWeight: 'bold',
    marginBottom: odeSpacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: odeTypography.bodySm,
    textAlign: 'center',
  },
  listContent: {
    paddingVertical: odeSpacing.sm,
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
