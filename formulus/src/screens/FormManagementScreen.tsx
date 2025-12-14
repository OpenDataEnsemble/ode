import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {FormService, FormSpec} from '../services';
import {Observation} from '../database/models/Observation';
import {openFormplayerFromNative} from '../webview/FormulusMessageHandlers';
import {ObservationCard, EmptyState} from '../components/common';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {MainAppStackParamList} from '../types/NavigationTypes';

type FormManagementScreenNavigationProp = StackNavigationProp<
  MainAppStackParamList,
  'ObservationDetail'
>;

/**
 * Screen for managing forms and observations (admin only)
 */
const FormManagementScreen = () => {
  const navigation = useNavigation<FormManagementScreenNavigationProp>();
  const [formSpecs, setFormSpecs] = useState<FormSpec[]>([]);
  const [observations, setObservations] = useState<
    Record<string, Observation[]>
  >({});
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);
  const [formService, setFormService] = useState<FormService | null>(null);

  // Load form types and observations
  useEffect(() => {
    const initFormService = async () => {
      try {
        const service = await FormService.getInstance();
        setFormService(service);
        const specs = service.getFormSpecs();
        setFormSpecs(specs);
      } catch (error) {
        console.error('Failed to initialize FormService:', error);
      }
    };

    initFormService();
  }, []);

  useEffect(() => {
    if (formService) {
      loadData();
    }
  }, [formService]);

  // Function to load form types and observations
  const loadData = async () => {
    if (!formService) {
      Alert.alert('Error', 'FormService is not initialized');
      return;
    }
    try {
      setLoading(true);

      // Get all form types
      const types = formService.getFormSpecs();
      setFormSpecs(types);

      // Get observations for each form type
      const observationsMap: Record<string, Observation[]> = {};

      for (const formType of types) {
        const formObservations = await formService.getObservationsByFormType(
          formType.id,
        );
        observationsMap[formType.id] = formObservations;
      }

      setObservations(observationsMap);
    } catch (error) {
      console.error('Error loading form data:', error);
      Alert.alert('Error', 'Failed to load form data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  // Handle adding a new observation using the promise-based Formplayer API
  const handleAddObservation = async (formType: FormSpec) => {
    try {
      const result = await openFormplayerFromNative(formType.id, {}, {});
      if (
        result.status === 'form_submitted' ||
        result.status === 'form_updated'
      ) {
        await loadData();
      }
    } catch (error) {
      console.error(
        'Error while opening Formplayer for new observation:',
        error,
      );
      Alert.alert('Error', 'Failed to open form for new observation');
    }
  };

  // Handle editing an observation using the promise-based Formplayer API
  const handleEditObservation = async (
    formType: FormSpec,
    observation: Observation,
  ) => {
    try {
      const result = await openFormplayerFromNative(
        formType.id,
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
        await loadData();
      }
    } catch (error) {
      console.error(
        'Error while opening Formplayer for editing observation:',
        error,
      );
      Alert.alert('Error', 'Failed to open form for editing observation');
    }
  };

  // Handle viewing an observation
  const handleViewObservation = (observation: Observation) => {
    navigation.navigate('ObservationDetail', {
      observationId: observation.observationId,
    });
  };

  // Handle deleting an observation
  const handleDeleteObservation = async (
    formTypeId: string,
    observation: Observation,
  ) => {
    if (!formService) {
      Alert.alert('Error', 'FormService is not initialized');
      return;
    }
    try {
      Alert.alert(
        'Confirm Delete',
        'Are you sure you want to delete this observation?',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              await formService.deleteObservation(observation.observationId);
              await loadData();
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error deleting observation:', error);
      Alert.alert('Error', 'Failed to delete observation');
      setLoading(false);
    }
  };

  // Handle database reset
  const handleResetDatabase = async () => {
    if (!formService) {
      Alert.alert('Error', 'FormService is not initialized');
      return;
    }
    try {
      Alert.alert(
        'Reset Database',
        'Are you sure you want to delete ALL observations? This action cannot be undone.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Reset Database',
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              await formService.resetDatabase();
              await loadData();
              Alert.alert('Success', 'Database has been reset successfully.');
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error resetting database:', error);
      Alert.alert('Error', 'Failed to reset database');
      setLoading(false);
    }
  };

  // Toggle expanded state for a form
  const toggleExpanded = (formType: string) => {
    if (expandedFormId === formType) {
      setExpandedFormId(null);
    } else {
      setExpandedFormId(formType);
    }
  };

  // Render an observation item
  const renderObservationItem = ({item}: {item: Observation}) => {
    // For backward compatibility: if formTypeId is not set, use the parent form type
    const currentFormTypeId = item.formType;
    const parentFormType = expandedFormId
      ? formSpecs.find(ft => ft.id === expandedFormId)
      : null;

    // Use either the observation's formTypeId or the parent form type if we're in a specific form's context
    const formType =
      formSpecs.find(ft => ft.id === currentFormTypeId) || parentFormType;

    console.log(
      'Rendering observation:',
      item.observationId,
      'formTypeId:',
      currentFormTypeId,
      'formType found:',
      !!formType,
    );

    return (
      <View style={styles.observationItem}>
        <Text style={styles.observationId}>ID: {item.observationId}</Text>
        <Text>Created: {item.createdAt.toLocaleString()}</Text>
        <Text>
          Synced:{' '}
          {item.syncedAt &&
          item.syncedAt.getTime() > new Date('1980-01-01').getTime()
            ? 'Yes'
            : 'No'}
        </Text>

        <View style={styles.observationActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              Alert.alert(
                'View Observation',
                JSON.stringify(item.data, null, 2),
              )
            }>
            <Text style={styles.buttonText}>View Data</Text>
          </TouchableOpacity>

          {formType && (
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => handleEditObservation(formType, item)}>
              <Text style={styles.buttonText}>Edit</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteObservation(currentFormTypeId, item)}>
            <Text style={styles.buttonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
  const renderObservationItem = (
    observation: Observation,
    formType: FormSpec,
  ) => {
    return (
      <ObservationCard
        key={observation.observationId}
        observation={observation}
        formName={formType.name}
        onPress={() => handleViewObservation(observation)}
        onEdit={() => handleEditObservation(formType, observation)}
        onDelete={() => handleDeleteObservation(formType.id, observation)}
      />
    );
  };

  // Render a form spec item
  const renderFormSpecItem = ({item}: {item: FormSpec}) => {
    const formObservations = observations[item.id] || [];
    const isExpanded = expandedFormId === item.id;

    return (
      <View style={styles.formTypeContainer}>
        <TouchableOpacity
          style={styles.formTypeHeader}
          onPress={() => toggleExpanded(item.id)}>
          <View style={styles.formTypeInfo}>
            <Text style={styles.formTypeName}>{item.name}</Text>
            <Text style={styles.formTypeDescription}>{item.description}</Text>
            <Text style={styles.formTypeVersion}>
              Version: {item.schemaVersion}
            </Text>
          </View>
          <View style={styles.formTypeActions}>
            <Text style={styles.observationCount}>
              {formObservations.length} observation
              {formObservations.length !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => handleAddObservation(item)}>
              <Text style={styles.buttonText}>Add Observation</Text>
          onPress={() => toggleExpanded(item.id)}
          activeOpacity={0.7}>
          <View style={styles.formTypeInfo}>
            <View style={styles.iconContainer}>
              <Icon name="file-document-outline" size={32} color="#007AFF" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.formTypeName}>{item.name}</Text>
              {item.description && (
                <Text style={styles.formTypeDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              <View style={styles.metaContainer}>
                <Text style={styles.version}>v{item.schemaVersion}</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>
                    {formObservations.length}{' '}
                    {formObservations.length === 1 ? 'entry' : 'entries'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.formTypeActions}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={e => {
                e.stopPropagation();
                handleAddObservation(item);
              }}>
              <Icon name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Add</Text>
            </TouchableOpacity>
            <Icon
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#999"
            />
          </View>
        </TouchableOpacity>

        {isExpanded && formObservations.length > 0 && (
          <View style={styles.observationsWrapper}>
            {formObservations.map(observation => (
              <React.Fragment key={observation.observationId}>
                {renderObservationItem({item: observation})}
              </React.Fragment>
            ))}
          </View>
        )}

        {isExpanded && formObservations.length === 0 && (
          <Text style={styles.noObservations}>No observations found</Text>
        )}
        {isExpanded && (
          <View style={styles.observationsWrapper}>
            {formObservations.length > 0 ? (
              formObservations.map(observation =>
                renderObservationItem(observation, item),
              )
            ) : (
              <View style={styles.noObservationsContainer}>
                <EmptyState
                  icon="clipboard-text-outline"
                  title="No Observations"
                  message={`No observations have been created for ${item.name} yet.`}
                />
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Form Management</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
      ) : formSpecs.length > 0 ? (
  if (loading && formSpecs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading forms...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Form Management</Text>
        <Text style={styles.subtitle}>
          {formSpecs.length} form{formSpecs.length !== 1 ? 's' : ''} available
        </Text>
      </View>

      {formSpecs.length > 0 ? (
        <>
          <FlatList
            data={formSpecs}
            renderItem={renderFormSpecItem}
            keyExtractor={item => item.id}
            style={styles.formTypesList}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
          />

          <TouchableOpacity
            style={[styles.resetButton, {marginTop: 20}]}
            onPress={handleResetDatabase}>
            <Text style={styles.buttonText}>Reset Database</Text>
          </TouchableOpacity>

          {/* Debug button */}
          <TouchableOpacity
            style={[
              styles.resetButton,
              {marginTop: 10, backgroundColor: '#2196F3'},
            ]}
            onPress={async () => {
              if (!formService) {
                Alert.alert('Error', 'FormService is not initialized');
                return;
              }
              try {
                await formService.debugDatabase();
                Alert.alert(
                  'Debug',
                  'Check console logs for debug information',
                );
                // Reload data after debugging
                await loadData();
              } catch (error) {
                console.error('Debug error:', error);
                Alert.alert('Error', 'Debug failed');
              }
            }}>
            <Text style={styles.buttonText}>Debug Database</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.noFormsContainer}>
          <Text style={styles.noFormsTitle}>No Forms Available</Text>
          <Text style={styles.noFormsMessage}>
            No form specifications have been downloaded yet. To get started:
          </Text>
          <Text style={styles.noFormsStep}>
            1. Go to Settings and configure your server URL
          </Text>
          <Text style={styles.noFormsStep}>
            2. Log in with your credentials
          </Text>
          <Text style={styles.noFormsStep}>
            3. Go to Sync screen and tap "Update App Bundle"
          </Text>
          <Text style={styles.noFormsNote}>
            This will download the latest forms and app content from your
            server.
          </Text>
        </View>
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleResetDatabase}>
              <Icon name="database-remove" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Reset Database</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <EmptyState
          icon="file-document-outline"
          title="No Forms Available"
          message="No form specifications have been downloaded yet. To get started:"
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
  },
  formTypesList: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  formTypeContainer: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  formTypeInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  formTypeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  formTypeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  version: {
    fontSize: 12,
    color: '#999',
  },
  countBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '500',
  },
  formTypeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  observationsWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingTop: 8,
  },
  noObservationsContainer: {
    padding: 16,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});

export default FormManagementScreen;
