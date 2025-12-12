import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useForms} from '../hooks/useForms';
import {FormCard, EmptyState} from '../components/common';
import {openFormplayerFromNative} from '../webview/FormulusMessageHandlers';
import {useFocusEffect} from '@react-navigation/native';
import colors from '../theme/colors';

const FormsScreen: React.FC = () => {
  const {forms, loading, error, refresh, getObservationCount} = useForms();
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
    } catch (error) {
      console.error('Error opening form:', error);
      Alert.alert('Error', 'Failed to open form. Please try again.');
    }
  };

  const renderForm = ({item}: {item: any}) => {
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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary[500]} />
          <Text style={styles.loadingText}>Loading forms...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && forms.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="alert-circle-outline"
          title="Error Loading Forms"
          message={error}
          actionLabel="Retry"
          onAction={refresh}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Forms</Text>
        {forms.length > 0 && (
          <Text style={styles.subtitle}>
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
          data={forms}
          renderItem={renderForm}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}
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
  listContent: {
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.neutral[600],
  },
});

export default FormsScreen;
