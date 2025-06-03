import React, { useRef, useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Modal, TouchableOpacity, Text, Platform, Alert, ActivityIndicator } from 'react-native';
import CustomAppWebView, { CustomAppWebViewHandle } from '../components/CustomAppWebView';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { appEvents } from '../webview/FormulusMessageHandlers';
import { readFileAssets } from 'react-native-fs';

const INJECTION_SCRIPT_PATH = Platform.OS === 'android' 
  ? 'webview/FormulusInjectionScript.js'
  : 'FormulusInjectionScript.js';

import { 
  sendFormInit, 
  sendAttachmentData, 
  sendSavePartialComplete 
} from '../webview/FormulusWebViewHandler';
import { databaseService } from '../database';
import { FormService, FormType } from '../services';
import { Observation } from '../database/repositories/LocalRepoInterface';

interface FormplayerModalProps {
  visible: boolean;
  onClose: () => void;
  formType?: string; // Form type for new forms
  formVersion?: string; // Form version for new forms
  editObservation?: {
    formType: string; // Form type of the observation being edited
    observation: Observation; // Updated to use the Observation interface
  };
}

const FormplayerModal = ({ visible, onClose, formType, formVersion, editObservation }: FormplayerModalProps) => {
  const webViewRef = useRef<CustomAppWebViewHandle>(null);
  const [currentFormId, setCurrentFormId] = useState<string | null>(null);
  const [formTypes, setFormTypes] = useState<FormType[]>([]);
  const [selectedFormTypeId, setSelectedFormTypeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Use a ref to track processed submissions with timestamps - this won't trigger re-renders
  const processedSubmissions = useRef<Map<string, number>>(new Map());
  
  // Get the form service instance
  const formService = FormService.getInstance();
  
  // Path to the formplayer dist folder in assets
  const formplayerUri = Platform.OS === 'android' 
    ? 'file:///android_asset/formplayer_dist/index.html'
    : 'file:///formplayer_dist/index.html'; // Add iOS path

 
  // Initialize the form when the modal becomes visible
  useEffect(() => {
    if (visible) {
      console.log('Formplayer WebView opened, loading URI:', formplayerUri);
      
      // Load form types when the modal becomes visible
      const loadedFormTypes = formService.getFormTypes();
      setFormTypes(loadedFormTypes);
      
      // If editing an existing observation, set the form type
      if (editObservation && loadedFormTypes.length > 0) {
        const formType = loadedFormTypes.find(ft => ft.id === editObservation.formType);
        if (formType) {
          console.log('Editing existing observation for form type:', formType.id);
          setSelectedFormTypeId(formType.id);
        }
      }
    }
  }, [visible, formplayerUri, formService, editObservation]);

  // Listen for the closeFormplayer event
  useEffect(() => {
    const handleCloseFormplayer = () => {
      onClose();
    };
    
    // Add event listener
    appEvents.addListener('closeFormplayer', handleCloseFormplayer);
    
    // Clean up event listener on component unmount
    return () => {
      appEvents.removeListener('closeFormplayer', handleCloseFormplayer);
    };
  }, [onClose]);
  
  // Reset form state when modal becomes visible or invisible
  useEffect(() => {
    if (!visible) {
      // Reset form state when modal is closed
      setTimeout(() => {
        processedSubmissions.current.clear();
        setCurrentFormId(null);
        setSelectedFormTypeId(null);
      }, 300); // Small delay to ensure modal is fully closed
    }
  }, [visible]);

  // Handle WebView errors
  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
  };

  // Handle WebView load complete
  const handleWebViewLoad = () => {
    console.log('WebView loaded successfully');
    
    // If editing an existing observation
    if (editObservation && formTypes.length > 0) {
      const formType = formTypes.find(ft => ft.id === editObservation.formType);
      if (formType) {
        initializeForm(formType, editObservation.observation.data);
      }
    }
    // Otherwise initialize with the first available form type
    else if (formTypes.length > 0) {
      const initialFormType = formTypes[0];
      setSelectedFormTypeId(initialFormType.id);
      initializeForm(initialFormType);
    }
  };

  // Initialize a form with the given form type and optional existing data
  const initializeForm = (formType: FormType, existingData: any = {}) => {
    // Generate a unique form ID
    const formId = `form_${Date.now()}`;
    setCurrentFormId(formId);
    
    // Get the form schema and UI schema from the form type
    const schema = formType.schema;
    const uiSchema = formType.uiSchema;
    
    // Create the parameters for the form
    const params = {
      locale: 'en', 
      theme: 'default',
      schema: schema,
      uischema: uiSchema
    };
    
    // Use existing data if provided, otherwise empty object
    const savedData = existingData || {};
    
    // Log the form initialization
    console.log('Initializing form with:', {
      formId: formId,
      formType: formType.id,
      params: params,
      schemaType: typeof params.schema,
      uiSchemaType: typeof params.uischema,
      savedData: savedData,
      isEdit: Object.keys(existingData).length > 0
    });
    
    // Send the initialization data back to the Formplayer
    if (webViewRef.current) {
      // Create a non-null ref object to satisfy TypeScript
      const safeRef = { current: webViewRef.current };
      
      try {
        sendFormInit(safeRef, {
          formId,
          params,
          savedData
        });
        console.log('DEBUG: Form initialization data sent successfully');
      } catch (error) {
        console.error('DEBUG: Error sending form initialization data:', error);
      }
    } else {
      console.error('DEBUG: WebView reference is null, cannot send form initialization data');
    }
    
    console.log('Form initialized with ID:', formId, 'using schema and data');
  };

  // Handle saving partial form data
  const handleSavePartial = (formId: string, data: any) => {
    // In a real implementation, you would save this data to your app's storage
    console.log('Saving partial data for form:', formId, data);
    
    // Send a confirmation back to the Formplayer
    if (webViewRef.current) {
      sendSavePartialComplete(webViewRef as React.RefObject<CustomAppWebViewHandle>, formId, true);
    }
  };
  
  // Handle form submission from the WebView
  const handleSubmitForm = useCallback(async (formId: string, finalData: any) => {
    console.log('Form submission received:', { formId, finalDataType: typeof finalData });
    console.log('Form data preview:', JSON.stringify(finalData).substring(0, 100) + '...');
    
    // Generate a unique submission ID to track this specific submission attempt
    const submissionId = `${formId}_${Date.now()}`;
    
    // Validate that we have valid form data
    if (!finalData || typeof finalData !== 'object') {
      console.error(`[${submissionId}] Invalid form data received:`, finalData);
      Alert.alert('Error', 'Invalid form data received. Please try again.');
      return;
    }
    
    // If already submitting, prevent duplicate submissions
    if (isSubmitting) {
      console.log(`[${submissionId}] Already submitting a form, ignoring this submission`);
      return;
    }
    
    // Set submitting state to show loading indicator
    setIsSubmitting(true);
    
    // Create a unique submission key that combines form ID and a timestamp
    // This ensures we only save the form once per session, but allows retries if needed
    const currentTime = Date.now();
    const lastSubmissionTime = processedSubmissions.current.get(formId) || 0;
    
    // Only process submissions that are at least 2 seconds apart to prevent duplicates
    // but still allow retries if the first submission failed
    if (currentTime - lastSubmissionTime < 2000) {
      console.log(`[${submissionId}] Ignoring rapid duplicate submission for form:`, formId);
      console.log(`[${submissionId}] Time since last submission:`, currentTime - lastSubmissionTime, 'ms');
      setIsSubmitting(false);
      return;
    }
    
    // Mark this submission time
    processedSubmissions.current.set(formId, currentTime);
    console.log(`[${submissionId}] Processing submission for form:`, formId);
    
    // Get the local repository from the database service
    const localRepo = databaseService.getLocalRepo();
    if (!localRepo) {
      console.error(`[${submissionId}] Database repository not available`);
      Alert.alert('Error', 'Database not available. Please restart the app and try again.');
      setIsSubmitting(false);
      return;
    }
    
    try {
      // Determine the form type from props
      const activeFormType = editObservation?.formType || formType || 'unknown';
      console.log(`[${submissionId}] Using form type:`, activeFormType);
      
      // Ensure form data is properly structured before saving
      const processedData = typeof finalData === 'string' 
        ? JSON.parse(finalData) 
        : finalData;
      
      // Save the observation to the database
      if (editObservation && editObservation.observation) {
        console.log(`[${submissionId}] Updating existing observation:`, editObservation.observation.id);
        const updateSuccess = await localRepo.updateObservation(editObservation.observation.id, {
          data: processedData
        });
        
        if (!updateSuccess) {
          throw new Error('Failed to update observation');
        }
      } else {
        console.log(`[${submissionId}] Creating new observation for form type:`, activeFormType);
        const newId = await localRepo.saveObservation({
          formType: activeFormType,
          formVersion: formVersion || '1.0', // Use provided formVersion or default to '1.0'
          data: processedData,
          deleted: false
        });
        
        if (!newId) {
          throw new Error('Failed to save new observation');
        }
        console.log(`[${submissionId}] Successfully created observation with ID:`, newId);
      }
      
      // Show success message
      const successMessage = editObservation
        ? 'Observation updated successfully!'
        : 'Form submitted successfully!';
      
      Alert.alert('Success', successMessage, [{ text: 'OK', onPress: onClose }]);
      
      // Close the modal after successful submission
      setIsSubmitting(false);
      
      // No callback needed here, the onClose will trigger the parent to refresh
    } catch (error) {
      console.error(`[${submissionId}] Error saving form submission:`, error);
      Alert.alert('Error', 'Failed to save your form. Please try again.');
      setIsSubmitting(false);
    }
  }, [selectedFormTypeId, onClose, editObservation, isSubmitting]);
  
  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={isSubmitting ? undefined : onClose} 
            style={[styles.closeButton, isSubmitting && styles.disabledButton]}
          >
            <Icon name="close" size={24} color={isSubmitting ? '#ccc' : '#000'} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {editObservation ? 'Edit Observation' : 'New Observation'}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        
        <CustomAppWebView 
          ref={webViewRef}
          appUrl={formplayerUri}
          appName="Formplayer"
        />
        
        {/* Loading overlay */}
        {isSubmitting && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007bff" />
              <Text style={styles.loadingText}>Saving form data...</Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // To balance the close button width
  },
  closeButton: {
    padding: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
});

export default FormplayerModal;
