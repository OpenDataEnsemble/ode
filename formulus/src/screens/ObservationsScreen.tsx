import React, {useState, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useObservations} from '../hooks/useObservations';
import {
  ObservationCard,
  EmptyState,
  FormTypeSelector,
  SyncStatusButtons,
  SyncStatus,
} from '../components/common';
import {openFormplayerFromNative} from '../webview/FormulusMessageHandlers';
import {FormService} from '../services/FormService';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {MainAppStackParamList} from '../types/NavigationTypes';
import {Observation} from '../database/models/Observation';
import colors from '../theme/colors';

type ObservationsScreenNavigationProp = StackNavigationProp<
  MainAppStackParamList,
  'ObservationDetail'
>;

const ObservationsScreen: React.FC = () => {
  const navigation = useNavigation<ObservationsScreenNavigationProp>();
  const {
    filteredAndSorted,
    loading,
    error,
    refresh,
    searchQuery,
    setSearchQuery,
    sortOption,
    setSortOption,
  } = useObservations();
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [formNames, setFormNames] = useState<Record<string, string>>({});
  const [formTypes, setFormTypes] = useState<{id: string; name: string}[]>([]);
  const [selectedFormType, setSelectedFormType] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('all');
  const [showSearch, setShowSearch] = useState<boolean>(false);

  useFocusEffect(
    React.useCallback(() => {
      const loadFormData = async () => {
        try {
          const formService = await FormService.getInstance();
          const formSpecs = formService.getFormSpecs();
          const names: Record<string, string> = {};
          const types: {id: string; name: string}[] = [];
          formSpecs.forEach(form => {
            names[form.id] = form.name;
            types.push({id: form.id, name: form.name});
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
        const isSynced =
          obs.syncedAt &&
          obs.syncedAt.getTime() > new Date('1980-01-01').getTime();
        return syncStatus === 'synced' ? isSynced : !isSynced;
      });
    }

    return filtered;
  }, [filteredAndSorted, selectedFormType, syncStatus]);

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
    } catch (error) {
      console.error('Error editing observation:', error);
      Alert.alert('Error', 'Failed to edit observation. Please try again.');
    }
  };

  const handleDeleteObservation = async (observation: Observation) => {
    Alert.alert(
      'Delete Observation',
      'Are you sure you want to delete this observation? This action cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const formService = await FormService.getInstance();
              await formService.deleteObservation(observation.observationId);
              await refresh();
            } catch (error) {
              console.error('Error deleting observation:', error);
              Alert.alert('Error', 'Failed to delete observation.');
            }
          },
        },
      ],
    );
  };

  const renderObservation = ({item}: {item: Observation}) => {
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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary[500]} />
          <Text style={styles.loadingText}>Loading observations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && filteredAndSorted.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="alert-circle-outline"
          title="Error Loading Observations"
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
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Observations</Text>
          {finalFiltered.length > 0 && (
            <Text style={styles.subtitle}>
              {finalFiltered.length} observation
              {finalFiltered.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => setShowSearch(!showSearch)}>
          <Icon
            name={showSearch ? 'close' : 'magnify'}
            size={24}
            color={colors.brand.primary[500]}
          />
        </TouchableOpacity>
      </View>

      {showSearch && (
        <View style={styles.searchContainer}>
          <Icon
            name="magnify"
            size={20}
            color={colors.neutral[500]}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search observations..."
            placeholderTextColor={colors.neutral[500]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={20} color={colors.neutral[500]} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <FormTypeSelector
            options={formTypes}
            selectedId={selectedFormType}
            onSelect={setSelectedFormType}
            placeholder="All Forms"
          />
        </View>
        <View style={styles.filterRow}>
          <SyncStatusButtons
            selectedStatus={syncStatus}
            onStatusChange={setSyncStatus}
          />
        </View>
      </View>

      {finalFiltered.length === 0 ? (
        <EmptyState
          icon="clipboard-text-outline"
          title={
            searchQuery || selectedFormType || syncStatus !== 'all'
              ? 'No Observations Found'
              : 'No Observations Yet'
          }
          message={
            searchQuery || selectedFormType || syncStatus !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Start filling out forms to create observations. Your data will appear here once saved.'
          }
        />
      ) : (
        <FlatList
          data={finalFiltered}
          renderItem={renderObservation}
          keyExtractor={item => item.observationId}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerLeft: {
    flex: 1,
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
  searchButton: {
    padding: 4,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.neutral[900],
    paddingVertical: 10,
  },
  filtersContainer: {
    backgroundColor: colors.neutral.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    gap: 12,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
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

export default ObservationsScreen;
