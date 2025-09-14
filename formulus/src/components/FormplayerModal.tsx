import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, View, Modal, TouchableOpacity, Text, Platform, Alert, ActivityIndicator } from 'react-native';
import CustomAppWebView, { CustomAppWebViewHandle } from '../components/CustomAppWebView';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { appEvents, resolveFormOperation, resolveFormOperationByType } from '../webview/FormulusMessageHandlers';
import { readFileAssets } from 'react-native-fs';
import { FormInitData, FormCompletionResult } from '../webview/FormulusInterfaceDefinition';

const INJECTION_SCRIPT_PATH = Platform.OS === 'android' 
  ? 'webview/FormulusInjectionScript.js'
  : 'FormulusInjectionScript.js';

import { databaseService } from '../database';
import { FormSpec } from '../services'; // FormService will be imported directly
import { Observation } from '../database/models/Observation';

interface FormplayerModalProps {
  visible: boolean;
  onClose: () => void;
}

export interface FormplayerModalHandle {
  initializeForm: (formType: FormSpec, params: Record<string, any> | null, observationId: string | null, existingObservationData: Record<string, any> | null, operationId: string | null) => void;
}

import { FormService } from '../services/FormService'; // Import FormService

const FormplayerModal = forwardRef<FormplayerModalHandle, FormplayerModalProps>(({ visible, onClose }, ref) => {
  const webViewRef = useRef<CustomAppWebViewHandle>(null);
  const [formSpecs, setFormSpecs] = useState<FormSpec[]>([]);
  const [selectedFormSpecId, setSelectedFormSpecId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formService, setFormService] = useState<FormService | null>(null);
  const [isFormServiceLoading, setIsFormServiceLoading] = useState(true);
  
  // Internal state to track current form and observation data
  const [currentFormType, setCurrentFormType] = useState<string | null>(null);
  const [currentObservationId, setCurrentObservationId] = useState<string | null>(null);
  const [currentObservationData, setCurrentObservationData] = useState<Record<string, any> | null>(null);
  const [currentParams, setCurrentParams] = useState<Record<string, any> | null>(null);
  const [currentOperationId, setCurrentOperationId] = useState<string | null>(null);
  
  // State to track pending form initialization
  const [pendingFormInit, setPendingFormInit] = useState<{
    formType: FormSpec;
    params: Record<string, any> | null;
    observationId: string | null;
    existingObservationData: Record<string, any> | null;
    operationId: string | null;
  } | null>(null);
  
  // Track if form has been successfully submitted to avoid double resolution
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  
  // Use a ref to track processed submissions with timestamps - this won't trigger re-renders
  const processedSubmissions = useRef<Map<string, number>>(new Map());
  
  // Add state to track closing process and prevent multiple close attempts
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Initialize FormService and subscribe to cache invalidation
  useEffect(() => {
    const initFormService = async () => {
      try {
        const service = await FormService.getInstance();
        setFormService(service);
        setFormSpecs(service.getFormSpecs());
        setIsFormServiceLoading(false);
        console.log('FormService initialized successfully');
        
        // Subscribe to cache invalidation events
        const unsubscribe = service.onCacheInvalidated(() => {
          console.log('FormplayerModal: FormService cache invalidated, refreshing form specs');
          setFormSpecs(service.getFormSpecs());
        });
        
        // Return cleanup function
        return unsubscribe;
      } catch (error) {
        console.error('Failed to initialize FormService:', error);
        setIsFormServiceLoading(false);
        return () => {}; // Return empty cleanup function on error
      }
    };
    
    let cleanupPromise = initFormService();
    
    // Cleanup subscription on unmount
    return () => {
      cleanupPromise.then(cleanup => cleanup?.());
    };
  }, []);

  // Path to the formplayer dist folder in assets
  const formplayerUri = Platform.OS === 'android' 
    ? 'file:///android_asset/formplayer_dist/index.html'
    : 'file:///formplayer_dist/index.html'; // Add iOS path

 

  useEffect(() => {
    if (!formService || isFormServiceLoading) {
      // Wait for FormService to initialize
      return;
    }

    const loadedFormSpecs = formService.getFormSpecs();
    setFormSpecs(loadedFormSpecs);
    
  }, [visible, webViewRef, formService]);

  // Create a debounced close handler to prevent multiple rapid close attempts
  const handleClose = useCallback(() => {
    // Prevent multiple close attempts
    if (isClosing || isSubmitting) {
      console.log('FormplayerModal: Close attempt blocked - already closing or submitting');
      return;
    }
    
    console.log('FormplayerModal: Starting close process');
    setIsClosing(true);
    
    // Clear any existing timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    
    // Only resolve with cancelled status if form hasn't been successfully submitted
    if (!formSubmitted) {
      if (currentOperationId && currentFormType) {
        const completionResult: FormCompletionResult = {
          status: 'cancelled',
          formType: currentFormType,
          message: 'Form was closed without submission'
        };
        
        resolveFormOperation(currentOperationId, completionResult);
      } else if (currentFormType) {
        const completionResult: FormCompletionResult = {
          status: 'cancelled',
          formType: currentFormType,
          message: 'Form was closed without submission'
        };
        
        resolveFormOperationByType(currentFormType, completionResult);
      }
    }
    
    // Call the parent's onClose immediately
    onClose();
    
    // Reset closing state after a short delay to prevent rapid re-opening issues
    closeTimeoutRef.current = setTimeout(() => {
      setIsClosing(false);
    }, 500);
  }, [isClosing, isSubmitting, onClose, currentOperationId, currentFormType]);

  // Listen for the closeFormplayer event
  useEffect(() => {
    const handleCloseFormplayer = () => {
      handleClose();
    };
    
    // Add event listener
    appEvents.addListener('closeFormplayer', handleCloseFormplayer);
    
    // Clean up event listener on component unmount
    return () => {
      appEvents.removeListener('closeFormplayer', handleCloseFormplayer);
    };
  }, [handleClose]);
  
  // Reset form state when modal becomes visible or invisible
  useEffect(() => {
    if (!visible) {
      // Reset form state when modal is closed
      setTimeout(() => {
        processedSubmissions.current.clear();
        setSelectedFormSpecId(null);
        setCurrentFormType(null);
        setCurrentObservationId(null);
        setCurrentObservationData(null);
        setPendingFormInit(null);
        setIsWebViewReady(false);
        setIsClosing(false); // Reset closing state when modal is fully closed
      }, 300); // Small delay to ensure modal is fully closed
    }
  }, [visible]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // Handle WebView errors
  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
  };

  // Handle WebView load complete
  const handleWebViewLoad = () => {
    console.log('FormplayerModal: WebView loaded successfully (onLoadEnd) - ready to initialize form');    
    setIsWebViewReady(true);
  };

  // Initialize a form with the given form type and optional existing data
  const initializeForm = (formType: FormSpec, params: Record<string, any> | null, observationId: string | null, existingObservationData: Record<string, any> | null, operationId: string | null) => {
    
    // Set internal state for the current form and observation
    setCurrentFormType(formType.id);
    setCurrentObservationId(observationId);
    setCurrentObservationData(existingObservationData);
    setCurrentParams(params);
    setCurrentOperationId(operationId);
    setFormSubmitted(false); // Reset submission flag for new form
    setSelectedFormSpecId(formType.id);
    
    // Store the form initialization data
    setPendingFormInit({
      formType,
      params,
      observationId,
      existingObservationData,
      operationId,
    });
  };

  useEffect(() => {
    if (isWebViewReady && pendingFormInit) {
      const { formType, params, observationId, existingObservationData } = pendingFormInit;
      
      // Create the parameters for the form
      const formParams = {
        locale: 'en', 
        theme: 'default',
        //schema: formType.schema,
        //uischema: formType.uiSchema,
        ...params
      };
      
      // Log the form initialization
      const formInitData = {
        formType: formType.id,
        observationId: observationId,
        params: formParams,
        savedData: existingObservationData || {},
        formSchema: formType.schema,
        uiSchema: formType.uiSchema
      };
      
      console.log('Initializing form with:', formInitData);
      
      // Send the initialization data back to the Formplayer
      if (webViewRef.current) {
        try {
          webViewRef.current?.sendFormInit(formInitData);
        } catch (error) {
          console.error('Error sending form init data:', error);
        }
      }
      
      // Clear the pending form initialization state
      setPendingFormInit(null);
    }
  }, [isWebViewReady, pendingFormInit]);

  // Handle saving partial form data
  const handleSavePartial = (formId: string, data: any) => {
    // In a real implementation, you would save this data to your app's storage
    console.log('Saving partial data for form:', formId, data);
    
    // Send a confirmation back to the Formplayer
    if (webViewRef.current) {
      webViewRef.current?.sendSavePartialComplete(formId, true);
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
      const activeFormType = currentFormType;
      if (!activeFormType) {
        console.error(`[${submissionId}] Active form type is null`);
        Alert.alert('Error', 'Invalid form type. Please try again.');
        setIsSubmitting(false);
        return;
      }
      console.log(`[${submissionId}] Using form type:`, activeFormType);
      
      // Ensure form data is properly structured before saving
      const processedData = typeof finalData === 'string' 
        ? JSON.parse(finalData) 
        : finalData;
      
      // Save the observation to the database
      let resultObservationId: string;
      if (currentObservationId) {
        console.log(`[${submissionId}] Updating existing observation:`, currentObservationId);
        const updateSuccess = await localRepo.updateObservation({id:currentObservationId, data: processedData});
        
        if (!updateSuccess) {
          throw new Error('Failed to update observation');
        }
        resultObservationId = currentObservationId;
      } else {
        console.log(`[${submissionId}] Creating new observation for form type:`, activeFormType);
        const newId = await localRepo.saveObservation({formType:activeFormType, data: processedData});
        
        if (!newId) {
          throw new Error('Failed to save new observation');
        }
        console.log(`[${submissionId}] Successfully created observation with ID:`, newId);
        resultObservationId = newId;
      }
      
      // Show success message
      const successMessage = currentObservationId
        ? 'Observation updated successfully!'
        : 'Form submitted successfully!';
      
      // Resolve the form operation promise with success result
      const completionResult: FormCompletionResult = {
        status: currentObservationId ? 'form_updated' : 'form_submitted',
        observationId: resultObservationId,
        formData: processedData,
        formType: activeFormType
      };
      
      // Mark form as successfully submitted to prevent cancelled status on close
      setFormSubmitted(true);
      
      if (currentOperationId) {
        resolveFormOperation(currentOperationId, completionResult);
      } else {
        resolveFormOperationByType(activeFormType, completionResult);
      }
      
      Alert.alert('Success', successMessage, [{ text: 'OK', onPress: onClose }]);
      
      // Close the modal after successful submission
      setIsSubmitting(false);
      
      // No callback needed here, the onClose will trigger the parent to refresh
    } catch (error) {
      console.error(`[${submissionId}] Error saving form submission:`, error);
      
      // Resolve the form operation promise with error result
      const errorResult: FormCompletionResult = {
        status: 'error',
        formType: currentFormType || 'unknown',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      
      if (currentOperationId) {
        resolveFormOperation(currentOperationId, errorResult);
      } else if (currentFormType) {
        resolveFormOperationByType(currentFormType, errorResult);
      }
      
      Alert.alert('Error', 'Failed to save your form. Please try again.');
      setIsSubmitting(false);
    }
  }, [selectedFormSpecId, onClose, currentFormType, currentObservationId, currentOperationId, isSubmitting]);

  useImperativeHandle(ref, () => ({ initializeForm }));

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
            onPress={handleClose} 
            style={[styles.closeButton, (isSubmitting || isClosing) && styles.disabledButton]}
            disabled={isSubmitting || isClosing}
          >
            <Icon name="close" size={24} color={(isSubmitting || isClosing) ? '#ccc' : '#000'} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {currentObservationId ? 'Edit Observation' : 'New Observation'}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        
        <CustomAppWebView 
          ref={webViewRef}
          appUrl={formplayerUri}
          appName="Formplayer"
          onLoadEndProp={handleWebViewLoad}
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
});

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
