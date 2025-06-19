import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert
} from 'react-native';
import { FormService, FormSpec } from '../services';
import { Observation } from '../database/models/Observation';
import FormplayerModal, { FormplayerModalHandle } from '../components/FormplayerModal';

/**
 * Screen for managing forms and observations (admin only)
 */
const FormManagementScreen = ({ navigation }: any) => {
  const [formSpecs, setFormSpecs] = useState<FormSpec[]>([]);
  const [observations, setObservations] = useState<Record<string, Observation[]>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [formModalVisible, setFormModalVisible] = useState<boolean>(false);
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);
  const [formService, setFormService] = useState<FormService | null>(null);
  const formplayerModalRef = useRef<FormplayerModalHandle>(null);
  
  // Load form types and observations
  useEffect(() => {
    const initFormService = async () => {
      try {
        const service = await FormService.getInstance();
        setFormService(service);
        const specs = service.getFormSpecs();
        console.log('FormSpecs:', specs);
        setFormSpecs(specs);
        console.log('FormService initialized successfully');
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
      const types = await formService.getFormSpecs();
      setFormSpecs(types);
      
      // Get observations for each form type
      const observationsMap: Record<string, Observation[]> = {};
      
      for (const formType of types) {
        const formObservations = await formService.getObservationsByFormType(formType.id);
        observationsMap[formType.id] = formObservations;
      }
      
      setObservations(observationsMap);
    } catch (error) {
      console.error('Error loading form data:', error);
      Alert.alert('Error', 'Failed to load form data');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle adding a new observation
  const handleAddObservation = (formType: FormSpec) => {
    setFormModalVisible(true);
    formplayerModalRef.current?.initializeForm(formType, null, null, null);
  };
  
  // Handle editing an observation
  const handleEditObservation = (formType: FormSpec, observation: Observation) => {
    setFormModalVisible(true);
    formplayerModalRef.current?.initializeForm(formType, null, observation.id, observation.data);
  };
  
  // Handle deleting an observation
  const handleDeleteObservation = async (formTypeId: string, observation: Observation) => {
    if (!formService) {
      Alert.alert('Error', 'FormService is not initialized');
      return;
    }
    try {
      Alert.alert(
        'Confirm Delete',
        'Are you sure you want to delete this observation?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              await formService.deleteObservation(observation.id);
              // Reload data after deletion
              await loadData();
            }
          },
        ]
      );
    } catch (error) {
      console.error('Error deleting observation:', error);
      Alert.alert('Error', 'Failed to delete observation');
      setLoading(false);
    }
  };
  
  // Handle form modal close
  const handleFormModalClose = () => {
    setFormModalVisible(false);
    // Reload data to show new observations
    loadData();
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
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Reset Database', 
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              await formService.resetDatabase();
              // Reload data after reset
              await loadData();
              Alert.alert('Success', 'Database has been reset successfully.');
            }
          },
        ]
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
  const renderObservationItem = ({ item }: { item: Observation }) => {
    // For backward compatibility: if formTypeId is not set, use the parent form type
    const currentFormTypeId = item.formType;
    const parentFormType = expandedFormId ? formSpecs.find(ft => ft.id === expandedFormId) : null;
    
    // Use either the observation's formTypeId or the parent form type if we're in a specific form's context
    const formType = formSpecs.find(ft => ft.id === currentFormTypeId) || parentFormType;
    
    console.log('Rendering observation:', item.id, 'formTypeId:', currentFormTypeId, 'formType found:', !!formType);
    
    return (
      <View style={styles.observationItem}>
        <Text style={styles.observationId}>ID: {item.id}</Text>
        <Text>Created: {item.createdAt.toLocaleString()}</Text>
        <Text>Synced: {item.syncedAt && item.syncedAt.getTime() > new Date('1980-01-01').getTime() ? 'Yes' : 'No'}</Text>
        
        <View style={styles.observationActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => Alert.alert('View Observation', JSON.stringify(item.data, null, 2))}
          >
            <Text style={styles.buttonText}>View Data</Text>
          </TouchableOpacity>
          
          {formType && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.editButton]}
              onPress={() => handleEditObservation(formType, item)}
            >
              <Text style={styles.buttonText}>Edit</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteObservation(currentFormTypeId, item)}
          >
            <Text style={styles.buttonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
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
        >
          <View style={styles.formTypeInfo}>
            <Text style={styles.formTypeName}>{item.name}</Text>
            <Text style={styles.formTypeDescription}>{item.description}</Text>
            <Text style={styles.formTypeVersion}>Version: {item.schemaVersion}</Text>
          </View>
          <View style={styles.formTypeActions}>
            <Text style={styles.observationCount}>
              {formObservations.length} observation{formObservations.length !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => handleAddObservation(item)}
            >
              <Text style={styles.buttonText}>Add Observation</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        
        {isExpanded && formObservations.length > 0 && (
          <View style={styles.observationsWrapper}>
            {formObservations.map(observation => (
              <React.Fragment key={observation.id}>
                {renderObservationItem({ item: observation })}
              </React.Fragment>
            ))}  
          </View>
        )}
        
        {isExpanded && formObservations.length === 0 && (
          <Text style={styles.noObservations}>No observations found</Text>
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
        <>
          <FlatList
            data={formSpecs}
            renderItem={renderFormSpecItem}
            keyExtractor={(item) => item.id}
            style={styles.formTypesList}
          />
          
          <TouchableOpacity 
            style={[styles.resetButton, { marginTop: 20 }]}
            onPress={handleResetDatabase}
          >
            <Text style={styles.buttonText}>Reset Database</Text>
          </TouchableOpacity>
          
          {/* Debug button */}
          <TouchableOpacity 
            style={[styles.resetButton, { marginTop: 10, backgroundColor: '#2196F3' }]}
            onPress={async () => {
              if (!formService) {
                Alert.alert('Error', 'FormService is not initialized');
                return;
              }
              try {
                await formService.debugDatabase();
                Alert.alert('Debug', 'Check console logs for debug information');
                // Reload data after debugging
                await loadData();
              } catch (error) {
                console.error('Debug error:', error);
                Alert.alert('Error', 'Debug failed');
              }
            }}
          >
            <Text style={styles.buttonText}>Debug Database</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.noForms}>No form types available</Text>
      )}
      
      <FormplayerModal
        ref={formplayerModalRef}
        visible={formModalVisible}
        onClose={handleFormModalClose}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  formTypesList: {
    flex: 1,
  },
  formTypeContainer: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  formTypeHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  formTypeInfo: {
    flex: 1,
  },
  formTypeName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  formTypeDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  formTypeVersion: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  formTypeActions: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  observationCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  observationsWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  observationItem: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  observationId: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  observationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 8,
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#28a745',
  },
  editButton: {
    backgroundColor: '#007bff',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  resetButton: {
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  noForms: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 32,
    color: '#666',
  },
  noObservations: {
    padding: 16,
    textAlign: 'center',
    color: '#666',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default FormManagementScreen;
