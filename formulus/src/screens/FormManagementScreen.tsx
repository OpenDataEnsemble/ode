import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/material-design-icons';
import { FormService, FormSpec } from '../services';
import { Observation } from '../database/models/Observation';
import { openFormplayerFromNative } from '../webview/FormulusMessageHandlers';
import { ObservationCard, EmptyState, Button } from '../components/common';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MainAppStackParamList } from '../types/NavigationTypes';
import { colors } from '../theme/colors';
import { useConfirmModal } from '../contexts/ConfirmModalContext';

type FormManagementScreenNavigationProp = StackNavigationProp<
  MainAppStackParamList,
  'ObservationDetail'
>;

/**
 * Screen for managing forms and observations (admin only)
 */
const FormManagementScreen = () => {
  const navigation = useNavigation<FormManagementScreenNavigationProp>();
  const { showConfirm } = useConfirmModal();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      showConfirm({
        title: 'Confirm Delete',
        message: 'Are you sure you want to delete this observation?',
        buttons: [
          { text: 'Cancel', onPress: () => {}, variant: 'tertiary' },
          {
            text: 'Delete',
            variant: 'danger',
            onPress: async () => {
              setLoading(true);
              await formService.deleteObservation(observation.observationId);
              await loadData();
            },
          },
        ],
      });
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
      showConfirm({
        title: 'Reset Database',
        message:
          'Are you sure you want to delete ALL observations? This action cannot be undone.',
        buttons: [
          { text: 'Cancel', onPress: () => {}, variant: 'tertiary' },
          {
            text: 'Reset Database',
            variant: 'danger',
            onPress: async () => {
              setLoading(true);
              await formService.resetDatabase();
              await loadData();
              Alert.alert('Success', 'Database has been reset successfully.');
            },
          },
        ],
      });
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
  const renderFormSpecItem = ({ item }: { item: FormSpec }) => {
    const formObservations = observations[item.id] || [];
    const isExpanded = expandedFormId === item.id;

    return (
      <View style={styles.formTypeContainer}>
        <TouchableOpacity
          style={styles.formTypeHeader}
          onPress={() => toggleExpanded(item.id)}
          activeOpacity={0.7}>
          <View style={styles.formTypeInfo}>
            <View style={styles.iconContainer}>
              <Icon
                name="file-document-outline"
                size={32}
                color={colors.semantic.info.ios}
              />
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
            <Button
              title="Add"
              onPress={() => handleAddObservation(item)}
              variant="primary"
              size="small"
            />
            <Icon
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={colors.neutral[500]}
            />
          </View>
        </TouchableOpacity>

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

  if (loading && formSpecs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.semantic.info.ios} />
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

          <View style={styles.footer}>
            <Button
              title="Reset Database"
              onPress={handleResetDatabase}
              variant="secondary"
              size="medium"
              fullWidth
            />
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
    backgroundColor: colors.ui.gray.lighter,
  },
  header: {
    padding: 16,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.gray.light,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.neutral[800],
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral[600],
  },
  formTypesList: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  formTypeContainer: {
    marginBottom: 12,
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
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
    backgroundColor: colors.semantic.info.light,
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
    color: colors.neutral[800],
    marginBottom: 4,
  },
  formTypeDescription: {
    fontSize: 14,
    color: colors.neutral[600],
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  version: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  countBadge: {
    backgroundColor: colors.semantic.info.light,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    color: colors.semantic.info.ios,
    fontWeight: '500',
  },
  formTypeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  observationsWrapper: {
    borderTopWidth: 1,
    borderTopColor: colors.ui.gray.light,
    paddingTop: 8,
  },
  noObservationsContainer: {
    padding: 16,
  },
  footer: {
    padding: 16,
    backgroundColor: colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: colors.ui.gray.light,
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

export default FormManagementScreen;
