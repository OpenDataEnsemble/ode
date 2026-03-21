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
  ActivityIndicator,
} from 'react-native';
import CustomAppWebView, {
  CustomAppWebViewHandle,
} from '../components/CustomAppWebView';
import { useScreenShellStyle } from '../hooks/useScreenShellStyle';
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
import colors from '../theme/colors';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeScreenHeaderHeight,
} from '../theme/odeDesign';
import { FormSpec } from '../services'; // FormService will be imported directly
import { ExtensionService } from '../services/ExtensionService';
import RNFS from 'react-native-fs';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useConfirmModal } from '../contexts/ConfirmModalContext';
import { geolocationService } from '../services/GeolocationService';

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
    observationId?: string | null;
  }) => Promise<string>;
}

const FormplayerModal = forwardRef<FormplayerModalHandle, FormplayerModalProps>(
  ({ visible, onClose }, ref) => {
    const webViewRef = useRef<CustomAppWebViewHandle>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showConfirm } = useConfirmModal();

    // Theme colors & resolved mode from AppThemeContext.
    const { themeColors, resolvedMode } = useAppTheme();
    const shellStyle = useScreenShellStyle();

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

    // Author-configurable display name shown in the native header bar
    const [currentFormDisplayName, setCurrentFormDisplayName] = useState<
      string | null
    >(null);

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

      geolocationService.clearCache();
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

      showConfirm({
        title: 'Close form?',
        message:
          'This will close the current form. Any changes made will not be saved, but will be available as a draft next time you open the form.',
        buttons: [
          { text: 'Cancel', variant: 'tertiary', onPress: () => {} },
          { text: 'Close form', variant: 'danger', onPress: performClose },
        ],
      });
    }, [isClosing, isSubmitting, performClose, showConfirm]);

    // Removed closeFormplayer event listener - now using direct promise-based submission handling

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current);
        }
      };
    }, []);

    // Track WebView ready state
    const [webViewReady, setWebViewReady] = useState(false);

    // Handle WebView load complete
    const handleWebViewLoad = () => {
      console.log('[FormplayerModal] WebView finished loading');
      setWebViewReady(true);
      // WebView is now ready to receive form initialization
    };

    // Initialize a form with the given form type and optional existing data
    const initializeForm = async (
      formType: FormSpec,
      params: Record<string, unknown> | null,
      observationId: string | null,
      existingObservationData: Record<string, unknown> | null,
      operationId: string | null,
    ) => {
      // Check if WebView is ready, if not log a warning (retry logic will handle it)
      if (!webViewReady) {
        console.warn(
          '[FormplayerModal] WebView not ready yet, form init will be queued by message handler',
        );
      }

      // Start GPS acquisition early so the fix is ready at save time
      geolocationService.preCacheLocation();

      setCurrentFormType(formType.id);
      setCurrentObservationId(observationId);

      // Resolve display name: ui schema headerTitle > schema title > form spec name
      const uiSchemaObj = formType.uiSchema as
        | Record<string, unknown>
        | undefined;
      const schemaObj = formType.schema as Record<string, unknown> | undefined;
      const uiOptions = uiSchemaObj?.options as
        | Record<string, unknown>
        | undefined;
      const displayName =
        (uiOptions?.headerTitle as string) ||
        (schemaObj?.title as string) ||
        formType.name;
      setCurrentFormDisplayName(displayName);
      setCurrentObservationData(existingObservationData);
      setCurrentParams(params);
      setCurrentOperationId(operationId);
      setFormSubmitted(false); // Reset submission flag for new form

      // Forward the custom app's theme colors to the Formplayer WebView so
      // that form UI elements (buttons, inputs, headers) match the branding.
      const isDark = resolvedMode === 'dark';

      const formParams = {
        locale: 'en',
        theme: 'default',
        darkMode: isDark,
        themeColors, // ← custom app palette forwarded to Formplayer
        ...params,
      };

      // Load extensions for this form
      const customAppPath = RNFS.DocumentDirectoryPath + '/app';
      let extensions = undefined;
      try {
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
        showConfirm({
          title: 'Form Error',
          message: `Form "${formType.name}" has no schema. The form may not have loaded correctly from storage. Try syncing again.`,
          buttons: [{ text: 'OK', variant: 'primary', onPress: () => {} }],
        });
        return;
      }

      // Scan custom question types and validators, read their source code
      // Check app/question_types and app/validators (bundle root) and app/forms/question_types, app/forms/validators (legacy)
      let customQuestionTypes = undefined;
      try {
        const qtDirs = [
          `${customAppPath}/question_types`,
          `${customAppPath}/forms/question_types`,
          RNFS.DocumentDirectoryPath + '/forms/question_types',
        ];

        const validatorDirs = [
          `${customAppPath}/validators`,
          `${customAppPath}/forms/validators`,
          RNFS.DocumentDirectoryPath + '/forms/validators',
        ];

        const custom_types: Record<string, { source: string }> = {};
        const validators: Record<string, { source: string }> = {};

        // Scan custom question types
        for (const qtDir of qtDirs) {
          const qtDirExists = await RNFS.exists(qtDir);
          if (!qtDirExists) {
            continue;
          }

          const folders = await RNFS.readDir(qtDir);

          for (const folder of folders) {
            if (folder.isDirectory() && !custom_types[folder.name]) {
              // Try renderer.js first, then index.js as fallback
              const rendererPath = `${folder.path}/renderer.js`;
              const indexPath = `${folder.path}/index.js`;
              const hasRenderer = await RNFS.exists(rendererPath);
              const hasIndex = !hasRenderer && (await RNFS.exists(indexPath));
              const jsPath = hasRenderer
                ? rendererPath
                : hasIndex
                  ? indexPath
                  : null;

              if (jsPath) {
                // Read the source code so the WebView can evaluate it directly
                const source = await RNFS.readFile(jsPath, 'utf8');
                custom_types[folder.name] = { source };
                console.log(
                  `[FormplayerModal] Custom question type: "${folder.name}" (${source.length} bytes from ${jsPath})`,
                );
              } else {
                console.warn(
                  `[FormplayerModal] Skipping "${folder.name}": no renderer.js or index.js found`,
                );
              }
            }
          }
        }

        // Scan custom validators
        for (const validatorDir of validatorDirs) {
          const validatorDirExists = await RNFS.exists(validatorDir);
          if (!validatorDirExists) {
            continue;
          }

          const folders = await RNFS.readDir(validatorDir);

          for (const folder of folders) {
            if (folder.isDirectory() && !validators[folder.name]) {
              // Validators use index.js (standard convention)
              const indexPath = `${folder.path}/index.js`;
              const hasIndex = await RNFS.exists(indexPath);

              if (hasIndex) {
                // Read the source code so the WebView can evaluate it directly
                const source = await RNFS.readFile(indexPath, 'utf8');
                validators[folder.name] = { source };
                console.log(
                  `[FormplayerModal] Custom validator: "${folder.name}" (${source.length} bytes from ${indexPath})`,
                );
              } else {
                console.warn(
                  `[FormplayerModal] Skipping validator "${folder.name}": no index.js found`,
                );
              }
            }
          }
        }

        // Build manifest with both question types and validators
        if (
          Object.keys(custom_types).length > 0 ||
          Object.keys(validators).length > 0
        ) {
          customQuestionTypes = {
            custom_types:
              Object.keys(custom_types).length > 0 ? custom_types : undefined,
            validators:
              Object.keys(validators).length > 0 ? validators : undefined,
          };
        } else {
          console.warn(
            '[FormplayerModal] No custom question types or validators found in any path',
          );
        }
      } catch (error) {
        console.warn(
          'Failed to scan custom question types and validators:',
          error,
        );
      }

      const formInitData = {
        formType: formType.id,
        observationId: observationId,
        params: formParams,
        savedData: existingObservationData || {},
        formSchema: formType.schema,
        uiSchema: formType.uiSchema ?? {},
        extensions,
        customQuestionTypes,
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
        showConfirm({
          title: 'Error',
          message:
            'Failed to initialize the form UI. Please close and try again.',
          buttons: [{ text: 'OK', variant: 'primary', onPress: () => {} }],
        });
      }
    };

    // Handle form submission directly (called by WebView message handler)
    const handleSubmission = useCallback(
      async (data: {
        formType: string;
        finalData: Record<string, unknown>;
        observationId?: string | null;
      }): Promise<string> => {
        const {
          formType,
          finalData,
          observationId: observationIdFromBridge,
        } = data;
        const effectiveObservationId =
          observationIdFromBridge ?? currentObservationId;

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
          if (effectiveObservationId) {
            const updateSuccess = await localRepo.updateObservation({
              observationId: effectiveObservationId,
              data: finalData,
            });
            if (!updateSuccess) {
              throw new Error('Failed to update observation');
            }
            resultObservationId = effectiveObservationId;
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
            status: effectiveObservationId ? 'form_updated' : 'form_submitted',
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
          const successMessage = effectiveObservationId
            ? 'Observation updated successfully!'
            : 'Form submitted successfully!';
          showConfirm({
            title: 'Success',
            message: successMessage,
            buttons: [
              {
                text: 'OK',
                variant: 'primary',
                onPress: () => {
                  setIsSubmitting(false);
                  onClose();
                },
              },
            ],
          });

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

          showConfirm({
            title: 'Error',
            message: 'Failed to save your form. Please try again.',
            buttons: [{ text: 'OK', variant: 'primary', onPress: () => {} }],
          });
          throw error;
        }
      },
      [currentObservationId, currentOperationId, onClose, showConfirm],
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
          setCurrentFormDisplayName(null);
          setCurrentObservationId(null);
          setCurrentObservationData(null);
          setIsClosing(false); // Reset closing state when modal is fully closed
          setFormSubmitted(false); // Reset submission flag
          setWebViewReady(false); // Reset WebView ready state
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
        <View style={shellStyle}>
          <View
            style={[
              styles.container,
              { backgroundColor: themeColors.background as string },
            ]}>
            <View
              style={[
                styles.header,
                {
                  backgroundColor:
                    resolvedMode === 'dark'
                      ? (colors.neutral[900] as string)
                      : (colors.neutral[50] as string),
                  borderBottomColor: themeColors.divider as string,
                },
              ]}>
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
                style={[
                  styles.headerTitle,
                  { color: themeColors.onBackground },
                ]}
                numberOfLines={1}>
                {currentFormDisplayName ||
                  (currentObservationId
                    ? 'Edit Observation'
                    : 'New Observation')}
              </Text>
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
        </View>
      </Modal>
    );
  },
);
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.transparent,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    padding: odeSpacing.md,
    borderBottomWidth: odeBorderWidth.hairline,
    minHeight: odeScreenHeaderHeight,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderRadius: 0,
    overflow: 'visible',
  },
  headerTitle: {
    fontSize: odeTypography.screenTitle,
    fontWeight: 'bold',
    marginLeft: 0,
    flexShrink: 1,
  },
  closeButton: {
    padding: odeSpacing.xs,
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
