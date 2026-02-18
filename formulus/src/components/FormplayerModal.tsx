import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  StyleSheet,
  View,
  Modal,
  TouchableOpacity,
  Text,
  Platform,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import CustomAppWebView, {
  CustomAppWebViewHandle,
} from '../components/CustomAppWebView';
import Icon from '@react-native-vector-icons/material-icons';
import {
  resolveFormOperation,
  resolveFormOperationByType,
  setActiveFormplayerModal,
} from '../webview/FormulusMessageHandlers';
import {
  FormCompletionResult,
  FormInitData,
} from '../webview/FormulusInterfaceDefinition';

import { databaseService } from '../database';
import { colors } from '../theme/colors';
import { FormSpec } from '../services'; // FormService will be imported directly
import { ExtensionService } from '../services/ExtensionService';
import RNFS from 'react-native-fs';
import { useAppTheme } from '../contexts/AppThemeContext';

interface FormplayerModalProps {
  visible: boolean;
  onClose: () => void;
}

export interface FormplayerModalHandle {
  initializeForm: (
    formType: FormSpec,
    params: Record<string, unknown> | null,
    observationId: string | null,
    existingObservationData: Record<string, unknown> | null,
    operationId: string | null,
  ) => void;
  handleSubmission: (data: {
    formType: string;
    finalData: Record<string, unknown>;
  }) => Promise<string>;
}

const FormplayerModal = forwardRef<FormplayerModalHandle, FormplayerModalProps>(
  ({ visible, onClose }, ref) => {
    const webViewRef = useRef<CustomAppWebViewHandle>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const colorScheme = useColorScheme();

    // Theme colors from the AppThemeContext — updates automatically when
    // the custom app config is loaded or the color scheme changes.
    const { themeColors } = useAppTheme();

    // Internal state to track current form and observation data
    const [currentFormType, setCurrentFormType] = useState<string | null>(null);
    const [currentObservationId, setCurrentObservationId] = useState<
      string | null
    >(null);
    const [_currentObservationData, setCurrentObservationData] =
      useState<Record<string, unknown> | null>(null);
    const [_currentParams, setCurrentParams] = useState<Record<
      string,
      unknown
    > | null>(null);
    const [currentOperationId, setCurrentOperationId] = useState<string | null>(
      null,
    );

    // Track if form has been successfully submitted to avoid double resolution
    const [formSubmitted, setFormSubmitted] = useState(false);

    // Add state to track closing process and prevent multiple close attempts
    const [isClosing, setIsClosing] = useState(false);
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Path to the formplayer dist folder in assets
    const formplayerUri =
      Platform.OS === 'android'
        ? 'file:///android_asset/formplayer_dist/index.html'
        : `file://${RNFS.MainBundlePath}/formplayer_dist/index.html`;

    // Create a debounced close handler to prevent multiple rapid close attempts
    const performClose = useCallback(() => {
      // Prevent multiple close attempts
      if (isClosing || isSubmitting) return;

      setIsClosing(true);

      // Clear any existing timeout
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }

      // Only resolve with cancelled status if form hasn't been successfully submitted AND we have a valid operation
      if (!formSubmitted && currentOperationId) {
        const completionResult: FormCompletionResult = {
          status: 'cancelled',
          formType: currentFormType || 'unknown',
          message: 'Form was closed without submission',
        };

        resolveFormOperation(currentOperationId, completionResult);
        // Clear the operation ID immediately to prevent double resolution
        setCurrentOperationId(null);
      } else if (!formSubmitted && currentFormType) {
        const completionResult: FormCompletionResult = {
          status: 'cancelled',
          formType: currentFormType,
          message: 'Form was closed without submission',
        };

        resolveFormOperationByType(currentFormType, completionResult);
      }

      // Call the parent's onClose immediately
      onClose();

      // Reset closing state after a short delay to prevent rapid re-opening issues
      closeTimeoutRef.current = setTimeout(() => {
        setIsClosing(false);
      }, 500);
    }, [
      isClosing,
      isSubmitting,
      onClose,
      currentOperationId,
      currentFormType,
      formSubmitted,
    ]);

    const handleClose = useCallback(() => {
      if (isClosing || isSubmitting) return;

      if (webViewRef.current?.canGoBack?.()) {
        webViewRef.current.goBack();
        return;
      }

      Alert.alert(
        'Close form?',
        'This will close the current form. Any changes made will not be saved, but will be available as a draft next time you open the form.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Close form',
            style: 'destructive',
            onPress: () => {
              performClose();
            },
          },
        ],
      );
    }, [isClosing, isSubmitting, performClose]);

    // Removed closeFormplayer event listener - now using direct promise-based submission handling

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current);
        }
      };
    }, []);

    // Handle WebView load complete
    const handleWebViewLoad = () => {
      // WebView ready - no action needed
    };

    // Initialize a form with the given form type and optional existing data
    const initializeForm = async (
      formType: FormSpec,
      params: Record<string, unknown> | null,
      observationId: string | null,
      existingObservationData: Record<string, unknown> | null,
      operationId: string | null,
    ) => {
      // Set internal state for the current form and observation
      setCurrentFormType(formType.id);
      setCurrentObservationId(observationId);
      setCurrentObservationData(existingObservationData);
      setCurrentParams(params);
      setCurrentOperationId(operationId);
      setFormSubmitted(false); // Reset submission flag for new form

      // Forward the custom app's theme colors to the Formplayer WebView so
      // that form UI elements (buttons, inputs, headers) match the branding.
      // `themeColors` comes from useAppTheme() and is always up-to-date.
      const isDark = colorScheme === 'dark';

      const formParams = {
        locale: 'en',
        theme: 'default',
        darkMode: isDark,
        themeColors, // ← custom app palette forwarded to Formplayer
        ...params,
      };

      // Load extensions for this form
      let extensions = undefined;
      try {
        const customAppPath = RNFS.DocumentDirectoryPath + '/app';
        const extensionService = ExtensionService.getInstance();
        const mergedExtensions = await extensionService.getCustomAppExtensions(
          customAppPath,
          formType.id,
        );

        // Note: getDynamicChoiceList is provided by formplayer's builtinExtensions.
        // Do NOT add a fallback pointing to queryHelpers.js - that file may not exist
        // in the app bundle, and dynamic import of file:// in WebView often fails.
        if (!mergedExtensions.functions) {
          mergedExtensions.functions = {};
        }

        // Convert to formplayer format
        if (
          mergedExtensions.definitions ||
          mergedExtensions.functions ||
          mergedExtensions.renderers
        ) {
          extensions = {
            definitions: mergedExtensions.definitions,
            functions: Object.entries(mergedExtensions.functions).reduce(
              (acc, [key, func]) => {
                // Remove leading slash from module path to avoid double-slash in URL
                const modulePath = (func.module || '').replace(/^\/+/, '');
                acc[key] = {
                  name: func.name,
                  module: modulePath,
                  export: func.export,
                };
                return acc;
              },
              {} as Record<string, unknown>,
            ),
            renderers: Object.entries(mergedExtensions.renderers).reduce(
              (acc, [key, renderer]) => {
                // Remove leading slash from module path to avoid double-slash in URL
                const modulePath = (renderer.module || '').replace(/^\/+/, '');
                acc[key] = {
                  name: renderer.name,
                  format: renderer.format,
                  module: modulePath,
                  tester: renderer.tester,
                  renderer: renderer.renderer,
                };
                return acc;
              },
              {} as Record<string, unknown>,
            ),
            // Base path for loading modules (file:// URL for WebView)
            // Extensions are in the /forms directory
            basePath: `file://${customAppPath}/forms`,
          };
        }
      } catch (error) {
        console.warn('Failed to load extensions:', error);
        // Continue without extensions - not a fatal error
      }

      if (!formType.schema) {
        console.error(
          'FormplayerModal: formType.schema is null/undefined for form:',
          formType.id,
        );
        Alert.alert(
          'Form Error',
          `Form "${formType.name}" has no schema. The form may not have loaded correctly from storage. Try syncing again.`,
        );
        return;
      }

      const formInitData = {
        formType: formType.id,
        observationId: observationId,
        params: formParams,
        savedData: existingObservationData || {},
        formSchema: formType.schema,
        uiSchema: formType.uiSchema ?? {},
        extensions,
      } as FormInitData;

      if (!webViewRef.current) {
        console.warn(
          'FormplayerModal: WebView ref is not available when trying to initialize form',
        );
        return;
      }

      try {
        await webViewRef.current.sendFormInit(formInitData);
      } catch (error) {
        console.error('FormplayerModal: Error sending form init data:', error);
        Alert.alert(
          'Error',
          'Failed to initialize the form UI. Please close and try again.',
        );
      }
    };

    // Handle form submission directly (called by WebView message handler)
    const handleSubmission = useCallback(
      async (data: {
        formType: string;
        finalData: Record<string, unknown>;
      }): Promise<string> => {
        const { formType, finalData } = data;

        // Set submitting state
        setIsSubmitting(true);

        try {
          // Get the local repository from the database service
          const localRepo = databaseService.getLocalRepo();
          if (!localRepo) {
            throw new Error('Database repository not available');
          }

          // Save the observation
          let resultObservationId: string;
          if (currentObservationId) {
            const updateSuccess = await localRepo.updateObservation({
              observationId: currentObservationId,
              data: finalData,
            });
            if (!updateSuccess) {
              throw new Error('Failed to update observation');
            }
            resultObservationId = currentObservationId;
          } else {
            const newId = await localRepo.saveObservation({
              formType,
              data: finalData,
            });
            if (!newId) {
              throw new Error('Failed to save new observation');
            }
            resultObservationId = newId;
          }

          // Mark form as successfully submitted
          setFormSubmitted(true);

          // Resolve the form operation with success result
          const completionResult: FormCompletionResult = {
            status: currentObservationId ? 'form_updated' : 'form_submitted',
            observationId: resultObservationId,
            formData: finalData,
            formType: formType,
          };

          if (currentOperationId) {
            resolveFormOperation(currentOperationId, completionResult);
            // Clear the operation ID to prevent double resolution
            setCurrentOperationId(null);
          } else {
            resolveFormOperationByType(formType, completionResult);
          }

          // Show success message and close modal
          const successMessage = currentObservationId
            ? 'Observation updated successfully!'
            : 'Form submitted successfully!';
          Alert.alert('Success', successMessage, [
            {
              text: 'OK',
              onPress: () => {
                setIsSubmitting(false);
                onClose();
              },
            },
          ]);

          return resultObservationId;
        } catch (error) {
          console.error('FormplayerModal: Error in handleSubmission:', error);
          setIsSubmitting(false);

          // Resolve the form operation with error result
          const errorResult: FormCompletionResult = {
            status: 'error',
            formType: formType,
            message:
              error instanceof Error ? error.message : 'Unknown error occurred',
          };

          if (currentOperationId) {
            resolveFormOperation(currentOperationId, errorResult);
          } else {
            resolveFormOperationByType(formType, errorResult);
          }

          Alert.alert('Error', 'Failed to save your form. Please try again.');
          throw error;
        }
      },
      [currentObservationId, currentOperationId, onClose],
    );

    // Register/unregister modal with message handlers and reset form state
    useEffect(() => {
      if (visible) {
        // Register this modal as the active one for handling submissions
        setActiveFormplayerModal({ handleSubmission });
      } else {
        // Unregister when modal is closed
        setActiveFormplayerModal(null);

        // Reset form state when modal is closed
        setTimeout(() => {
          setCurrentFormType(null);
          setCurrentObservationId(null);
          setCurrentObservationData(null);
          setIsClosing(false); // Reset closing state when modal is fully closed
          setFormSubmitted(false); // Reset submission flag
        }, 300); // Small delay to ensure modal is fully closed
      }
    }, [visible, handleSubmission]);

    useImperativeHandle(ref, () => ({ initializeForm, handleSubmission }));

    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={visible}
        onRequestClose={handleClose}
        presentationStyle="fullScreen"
        statusBarTranslucent={false}>
        <View
          style={[styles.container, { backgroundColor: themeColors.surface }]}>
          <View
            style={[styles.header, { borderBottomColor: themeColors.divider }]}>
            <TouchableOpacity
              onPress={handleClose}
              style={[
                styles.closeButton,
                (isSubmitting || isClosing) && styles.disabledButton,
              ]}
              disabled={isSubmitting || isClosing}>
              <Icon
                name="close"
                size={24}
                color={
                  isSubmitting || isClosing
                    ? colors.neutral[400]
                    : themeColors.onBackground
                }
              />
            </TouchableOpacity>
            <Text
              style={[styles.headerTitle, { color: themeColors.onBackground }]}>
              {currentObservationId ? 'Edit Observation' : 'New Observation'}
            </Text>
            <View style={styles.headerRightSpacer} />
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
                <ActivityIndicator
                  size="large"
                  color={colors.semantic.info.ios}
                />
                <Text style={styles.loadingText}>Saving form data...</Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    );
  },
);
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // To balance the close button width
  },
  headerRightSpacer: {
    width: 40,
  },
  closeButton: {
    padding: 4,
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
    backgroundColor: colors.ui.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: colors.neutral.white,
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: colors.neutral[800],
  },
});

export default FormplayerModal;
