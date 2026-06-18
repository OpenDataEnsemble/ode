/// <reference types="vite/client" />
import React, {
  useCallback,
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  useMemo,
} from 'react';
import './App.css';
import { JsonForms } from '@jsonforms/react';
import {
  materialRenderers,
  materialCells,
} from '@jsonforms/material-renderers';
import { JsonSchema7, JsonFormsRendererRegistryEntry } from '@jsonforms/core';
import {
  Alert,
  Snackbar,
  CircularProgress,
  Box,
  Typography,
  ThemeProvider,
} from '@mui/material';
import { createTheme, getThemeOptions, CustomThemeColors } from './theme/theme';
import { tokens } from './theme/tokens-adapter';
import Ajv from 'ajv';
import type { ErrorObject } from 'ajv';
import addErrors from 'ajv-errors';
import addFormats from 'ajv-formats';
import * as MUI from '@mui/material';

// Import the FormulusInterface client
import FormulusClient from './services/FormulusInterface';
import { FormInitData } from './types/FormulusInterfaceDefinition';
import {
  applySchemaDefaultTokens,
  initialFormDataFromParams,
  prepareRootObservationData,
  shouldOfferDraftSelector,
} from './utils/formObservationData';
import {
  collectStickyFieldPaths,
  extractStickyValues,
  applyStickyDefaults,
} from './utils/stickyFieldHelpers';
import { stickyService } from './services/StickyService';

import SwipeLayoutRenderer, {
  swipeLayoutTester,
  groupAsSwipeLayoutTester,
} from './renderers/SwipeLayoutRenderer';
import { finalizeRenderer, finalizeTester } from './renderers/FinalizeRenderer';
import PhotoQuestionRenderer, {
  photoQuestionTester,
} from './renderers/PhotoQuestionRenderer';
import SignatureQuestionRenderer, {
  signatureQuestionTester,
} from './renderers/SignatureQuestionRenderer';
import FileQuestionRenderer, {
  fileQuestionTester,
} from './renderers/FileQuestionRenderer';
import AudioQuestionRenderer, {
  audioQuestionTester,
} from './renderers/AudioQuestionRenderer';
import GPSQuestionRenderer, {
  gpsQuestionTester,
} from './renderers/GPSQuestionRenderer';
import VideoQuestionRenderer, {
  videoQuestionTester,
} from './renderers/VideoQuestionRenderer';
import QrcodeQuestionRenderer, {
  qrcodeQuestionTester,
} from './renderers/QrcodeQuestionRenderer';
import HtmlLabelRenderer, {
  htmlLabelTester,
} from './renderers/HtmlLabelRenderer';
import AdateQuestionRenderer, {
  adateQuestionTester,
} from './renderers/AdateQuestionRenderer';
import SubObservationQuestionRenderer, {
  subObservationQuestionTester,
} from './renderers/SubObservationQuestionRenderer';
import { shellMaterialRenderers } from './theme/material-wrappers';
import { numberStepperRenderer } from './renderers/NumberStepperRenderer';
import DynamicEnumControl, { dynamicEnumTester } from './DynamicEnumControl';
import ShellInputControl, {
  shellInputControlTester,
} from './jsonforms/ShellInputControl';
import type { KeyboardPrimaryEnterKeyHint } from './utils/keyboardEnterKeyHint';

import ErrorBoundary from './components/ErrorBoundary';
import { draftService } from './services/DraftService';
import DraftSelector from './components/DraftSelector';
import { loadExtensions } from './services/ExtensionsLoader';
import { getBuiltinExtensions } from './builtinExtensions';
import { FormEvaluationProvider } from './FormEvaluationContext';
import { loadCustomQuestionTypes } from './services/CustomQuestionTypeLoader';
import { loadCustomValidators } from './services/CustomValidatorLoader';
import { customValidatorRegistry } from './services/CustomValidatorRegistry';
import { runCustomValidatorsAndRefreshData } from './services/customValidatorDataRefresh';
import { newDraftSessionKey } from './utils/draftSessionKey';

/** Embedded sub-observation session (also accepts legacy `returnOnly` from older hosts). */
function isSubObservationSession(init: FormInitData): boolean {
  const i = init as FormInitData & { returnOnly?: boolean };
  return Boolean(i.subObservationMode || i.returnOnly);
}

// Mock and DevTestbed are loaded only in development via dynamic import (see index.tsx).
// This keeps ~2000+ lines of mock code out of production bundles.
function isMockActive(): boolean {
  return !!(
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    (window as any).__FORMULUS_MOCK_ACTIVE__
  );
}
const DevTestbedLazy = import.meta.env.DEV
  ? React.lazy(() => import('./mocks/DevTestbed'))
  : null;

// Define interfaces for our form data structure
interface FormData {
  [key: string]: any;
}

// Define interfaces for form schema and UI schema
interface FormSchema extends JsonSchema7 {
  [key: string]: any;
}

interface FormUISchema {
  type: string;
  elements: any[];
  [key: string]: any;
}

// Function to ensure UI schema root is always SwipeLayout
const ensureSwipeLayoutRoot = (uiSchema: FormUISchema | null): FormUISchema => {
  if (!uiSchema) {
    // If no UI schema, create a basic SwipeLayout with empty elements
    return {
      type: 'SwipeLayout',
      elements: [],
    };
  }

  // If root is already SwipeLayout, return as is
  if (uiSchema.type === 'SwipeLayout') {
    return { ...uiSchema };
  }

  // If root is not SwipeLayout, wrap the entire schema in a SwipeLayout
  if (
    uiSchema.type === 'Group' ||
    uiSchema.type === 'VerticalLayout' ||
    uiSchema.type === 'HorizontalLayout' ||
    uiSchema.elements
  ) {
    console.log(
      `Root UI schema type is "${uiSchema.type}", wrapping in SwipeLayout`,
    );
    return {
      type: 'SwipeLayout',
      elements: [uiSchema],
    };
  }

  // If there are multiple root elements (array), wrap them in SwipeLayout
  if (Array.isArray(uiSchema)) {
    console.log('Multiple root elements detected, wrapping in SwipeLayout');
    return {
      type: 'SwipeLayout',
      elements: uiSchema,
    };
  }

  // Fallback: create SwipeLayout with the original schema as a single element
  return {
    type: 'SwipeLayout',
    elements: [uiSchema],
  };
};

// Function to process UI schema and ensure Finalize element is present
const processUISchemaWithFinalize = (
  uiSchema: FormUISchema | null,
  skipFinalize?: boolean,
): FormUISchema => {
  if (!uiSchema || !uiSchema.elements) {
    // If no UI schema or no elements, create a basic one with just Finalize
    return {
      type: 'VerticalLayout',
      elements: [
        {
          type: 'Finalize',
        },
      ],
    };
  }

  // Create a copy of the UI schema to avoid mutating the original
  const processedUISchema = { ...uiSchema };
  const elements = [...uiSchema.elements];

  // Check for existing Finalize elements and remove them
  const existingFinalizeIndices: number[] = [];
  elements.forEach((element, index) => {
    if (element && element.type === 'Finalize') {
      existingFinalizeIndices.push(index);
    }
  });

  if (existingFinalizeIndices.length > 0) {
    console.warn(
      `Found ${existingFinalizeIndices.length} existing Finalize element(s) in UI schema. Removing them as they will be automatically added.`,
    );
    // Remove existing Finalize elements (in reverse order to maintain indices)
    existingFinalizeIndices.reverse().forEach(index => {
      elements.splice(index, 1);
    });
  }

  // Append Finalize page unless skipFinalize (sub-observation fast path).
  if (!skipFinalize) {
    elements.push({
      type: 'Finalize',
    });
  }

  processedUISchema.elements = elements;
  return processedUISchema;
};

// Interface for the data structure passed to window.onFormInit
// Removed local definition, importing from FormulusInterfaceDefinition.ts

// Create context for sharing form metadata with renderers
interface FormContextType {
  formInitData: FormInitData | null;
  /**
   * Hint for mobile keyboard IME action (Go / Next / Done).
   * Set inside swipe layout; `undefined` elsewhere.
   */
  keyboardEnterKeyHint?: KeyboardPrimaryEnterKeyHint;
  /**
   * Formplayer-only: which local draft row to update for unsaved (new) observations.
   * Not part of the native bridge.
   */
  draftSessionKey: string | null;
}

export const FormContext = createContext<FormContextType>({
  formInitData: null,
  keyboardEnterKeyHint: undefined,
  draftSessionKey: null,
});

export const useFormContext = () => useContext(FormContext);

export const customRenderers = [
  {
    tester: shellInputControlTester,
    renderer: ShellInputControl,
  },
  { tester: swipeLayoutTester, renderer: SwipeLayoutRenderer },
  { tester: groupAsSwipeLayoutTester, renderer: SwipeLayoutRenderer },
  { tester: finalizeTester, renderer: finalizeRenderer.renderer },
  { tester: photoQuestionTester, renderer: PhotoQuestionRenderer },
  { tester: signatureQuestionTester, renderer: SignatureQuestionRenderer },
  { tester: fileQuestionTester, renderer: FileQuestionRenderer },
  { tester: audioQuestionTester, renderer: AudioQuestionRenderer },
  { tester: gpsQuestionTester, renderer: GPSQuestionRenderer },
  { tester: videoQuestionTester, renderer: VideoQuestionRenderer },
  { tester: qrcodeQuestionTester, renderer: QrcodeQuestionRenderer },
  { tester: htmlLabelTester, renderer: HtmlLabelRenderer },
  { tester: adateQuestionTester, renderer: AdateQuestionRenderer },
  {
    tester: subObservationQuestionTester,
    renderer: SubObservationQuestionRenderer,
  },
  // Dynamic choice list renderer for x-dynamicEnum fields
  { tester: dynamicEnumTester, renderer: DynamicEnumControl },
  // Number/integer fields with simple +/- buttons via InputAdornment
  numberStepperRenderer,
];

// Expose React and MaterialUI to global scope for custom question type renderers
// This must be done synchronously at module load time so renderers can access them
if (typeof window !== 'undefined') {
  (window as any).React = React;
  (window as any).MaterialUI = MUI;
  console.log(
    '[App] Exposed React and MaterialUI to global scope for custom renderers',
  );
}

function App() {
  // WebView mock is initialized in index.tsx (dev only, via dynamic import)

  // State for form data, schema, and UI schema
  const [data, setData] = useState<FormData>({});
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [uischema, setUISchema] = useState<FormUISchema | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showFinalizeMessage, setShowFinalizeMessage] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formInitData, setFormInitData] = useState<FormInitData | null>(null);
  /** Local draft identity for new observations only (not sent over the native bridge). */
  const [draftSessionKey, setDraftSessionKey] = useState<string | null>(null);
  const [showDraftSelector, setShowDraftSelector] = useState(false);
  const [pendingFormInit, setPendingFormInit] = useState<FormInitData | null>(
    null,
  );
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [customThemeColors, setCustomThemeColors] = useState<
    CustomThemeColors | undefined
  >(undefined);
  const [extensionRenderers, setExtensionRenderers] = useState<
    JsonFormsRendererRegistryEntry[]
  >([]);
  // Store extension functions for potential future use (e.g., validation context injection)

  const [extensionFunctions, setExtensionFunctions] = useState<
    Map<string, (...args: any[]) => any>
  >(new Map());
  const [extensionDefinitions, setExtensionDefinitions] = useState<
    Record<string, any>
  >({});
  // Custom question type renderers (loaded from custom_app)
  const [customTypeRenderers, setCustomTypeRenderers] = useState<
    JsonFormsRendererRegistryEntry[]
  >([]);
  const [customTypeFormats, setCustomTypeFormats] = useState<string[]>([]);
  // Custom validator errors (merged with AJV errors)
  const [customValidatorErrors, setCustomValidatorErrors] = useState<
    ErrorObject[]
  >([]);
  // Deferred validation: new forms start hidden (no red errors on first paint),
  // then switch to ValidateAndShow on first forward navigation / finalize. Edits
  // and draft resumes start shown. Host can override via params.validationMode.
  const [validationMode, setValidationMode] = useState<
    'ValidateAndShow' | 'ValidateAndHide' | 'NoValidation'
  >('ValidateAndShow');

  // Reference to the FormulusClient instance and loading state
  const formulusClient = useRef<FormulusClient>(FormulusClient.getInstance());
  const isLoadingRef = useRef<boolean>(true); // Use a ref to track loading state for the timeout

  // Separate function to handle actual form initialization
  const initializeForm = useCallback(
    async (
      initData: FormInitData,
      /** When `observationId` is null: explicit session key (resume / start-new); omit to create one. */
      newObservationDraftSessionKey?: string | null,
    ) => {
      try {
        if (
          isSubObservationSession(initData) ||
          initData.observationId != null
        ) {
          // Sub-observation or editing an existing observation: no new-observation draft session key.
          setDraftSessionKey(null);
        } else if (newObservationDraftSessionKey !== undefined) {
          setDraftSessionKey(newObservationDraftSessionKey);
        } else {
          setDraftSessionKey(newDraftSessionKey());
        }

        const {
          formType: receivedFormType,
          params,
          savedData,
          formSchema,
          uiSchema,
          extensions,
        } = initData;
        const skipFinalize = Boolean(
          (initData as FormInitData & { skipFinalize?: boolean }).skipFinalize,
        );

        setFormInitData(initData);

        // Debug: log schema details, especially x-dynamicEnum usage
        try {
          const properties = (formSchema as any)?.properties || {};
          const dynamicEnumFields = Object.entries(properties)
            .filter(
              ([, propSchema]: [string, any]) =>
                !!propSchema?.['x-dynamicEnum'],
            )
            .map(([key]) => key);

          console.log('[Formplayer] Form init received', {
            formType: receivedFormType,
            hasSchema: !!formSchema,
            hasUISchema: !!uiSchema,
            propertyKeys: Object.keys(properties),
            dynamicEnumFields,
          });
        } catch (schemaLogError) {
          console.warn(
            '[Formplayer] Failed to log schema details',
            schemaLogError,
          );
        }

        // Extract dark mode preference from params
        const isDarkMode = params?.darkMode === true;
        setDarkMode(isDarkMode);

        // Extract custom app theme colors (forwarded by Formulus native host).
        // When present, these override the default @ode/tokens palette so that
        // form UI matches the custom app's branding.
        if (params?.themeColors && typeof params.themeColors === 'object') {
          setCustomThemeColors(params.themeColors as CustomThemeColors);
          console.log(
            '[Formplayer] Using custom app theme colors:',
            (params.themeColors as CustomThemeColors).primary,
          );
        }

        // Start with built-in extensions (always available)
        const allFunctions = getBuiltinExtensions() as Map<
          string,
          (...args: any[]) => any
        >;

        // Load extensions if provided
        if (extensions) {
          try {
            const extensionResult = await loadExtensions(extensions);

            // Merge loaded functions with built-ins (loaded functions take precedence)
            extensionResult.functions.forEach((func, name) => {
              allFunctions.set(name, func as (...args: any[]) => any);
            });

            setExtensionRenderers(extensionResult.renderers);
            setExtensionFunctions(allFunctions);
            setExtensionDefinitions(extensionResult.definitions);

            console.log(
              '[Formplayer] Final extension functions:',
              Array.from(allFunctions.keys()),
            );

            // Log errors but don't fail form initialization
            if (extensionResult.errors.length > 0) {
              console.warn('Extension loading errors:', extensionResult.errors);
            }
          } catch (error) {
            console.error('Failed to load extensions:', error);
            // Still use built-in functions even if loading fails
            setExtensionRenderers([]);
            setExtensionFunctions(allFunctions);
            setExtensionDefinitions({});
          }
        } else {
          // No extensions provided, just use built-ins
          setExtensionRenderers([]);
          setExtensionFunctions(allFunctions);
          setExtensionDefinitions({});
          console.log('[Formplayer] Using only built-in extensions');
        }

        // Load custom question types if provided
        const customQTManifest = initData.customQuestionTypes;
        if (customQTManifest) {
          try {
            const customQTResult =
              await loadCustomQuestionTypes(customQTManifest);
            setCustomTypeRenderers(customQTResult.renderers);
            setCustomTypeFormats(customQTResult.formats);
            console.log(
              `[Formplayer] Loaded ${customQTResult.renderers.length} custom question type(s): ${customQTResult.formats.join(', ')}`,
            );
            if (customQTResult.errors.length > 0) {
              console.warn(
                '[Formplayer] Custom question type loading errors:',
                customQTResult.errors,
              );
            }

            // Load custom validators if provided
            if (customQTManifest.validators) {
              try {
                const validatorResult =
                  await loadCustomValidators(customQTManifest);
                customValidatorRegistry.registerAll(validatorResult.validators);
                console.log(
                  `[Formplayer] Loaded ${validatorResult.validators.size} custom validator(s): ${Array.from(validatorResult.validators.keys()).join(', ')}`,
                );
                if (validatorResult.errors.length > 0) {
                  console.warn(
                    '[Formplayer] Custom validator loading errors:',
                    validatorResult.errors,
                  );
                }
              } catch (error) {
                console.error(
                  '[Formplayer] Failed to load custom validators:',
                  error,
                );
              }
            }
          } catch (error) {
            console.error(
              '[Formplayer] Failed to load custom question types:',
              error,
            );
            setCustomTypeRenderers([]);
            setCustomTypeFormats([]);
          }
        } else {
          setCustomTypeRenderers([]);
          setCustomTypeFormats([]);
        }

        if (!formSchema) {
          console.warn(
            'formSchema was not provided. Form rendering might fail or be incomplete.',
          );
          setLoadError(
            'Form schema is missing. Form rendering might fail or be incomplete.',
          );
          setSchema({} as FormSchema); // Set to empty schema or handle as per requirements
          // First ensure SwipeLayout root, then process to ensure Finalize element is present
          const swipeLayoutUISchema = ensureSwipeLayoutRoot(null);
          const processedUISchema = processUISchemaWithFinalize(
            swipeLayoutUISchema,
            skipFinalize,
          );
          setUISchema(processedUISchema);
        } else {
          setSchema(formSchema as FormSchema);
          const swipeLayoutUISchema = ensureSwipeLayoutRoot(
            uiSchema as FormUISchema,
          );
          const processedUISchema = processUISchemaWithFinalize(
            swipeLayoutUISchema,
            skipFinalize,
          );
          setUISchema(processedUISchema);
        }

        const formSchemaTyped = formSchema as FormSchema | null;
        // Deferred-validation policy. Honor an explicit host override first;
        // otherwise defer (hide) for brand-new observations and show for
        // edits / draft resumes so existing data is validated immediately.
        const paramValidationMode = (
          params as Record<string, unknown> | null
        )?.['validationMode'];
        const hasSavedData = Boolean(
          savedData && Object.keys(savedData).length > 0,
        );
        if (
          paramValidationMode === 'ValidateAndShow' ||
          paramValidationMode === 'ValidateAndHide' ||
          paramValidationMode === 'NoValidation'
        ) {
          setValidationMode(paramValidationMode);
        } else {
          setValidationMode(
            hasSavedData ? 'ValidateAndShow' : 'ValidateAndHide',
          );
        }

        // Reserved session-context channel: a custom app may pass
        // `params.context` (device role, selected cluster, etc.). It is excluded
        // from observation data (see FORMPARAMS_NON_DATA_KEYS) and exposed here
        // read-only so extensions / custom question types can react to it.
        const sessionContext = (params as Record<string, unknown> | null)?.[
          'context'
        ];
        (window as unknown as Record<string, unknown>).formulusSessionContext =
          sessionContext ?? null;

        if (savedData && Object.keys(savedData).length > 0) {
          console.log('Preloading saved data:', savedData);
          setData(
            prepareRootObservationData(savedData as FormData, formSchemaTyped),
          );
        } else if (!isSubObservationSession(initData)) {
          const formVersion = (formSchemaTyped as { version?: string })
            ?.version;
          const layoutRoot = ensureSwipeLayoutRoot(uiSchema as FormUISchema);
          const stickyPaths = collectStickyFieldPaths(layoutRoot);
          const stored = stickyService.getStickyValues(
            receivedFormType,
            formVersion,
          );
          const relevantSticky: Record<string, unknown> = {};
          for (const p of stickyPaths) {
            if (stored[p] !== undefined) relevantSticky[p] = stored[p];
          }
          const withTokens = applySchemaDefaultTokens(
            initialFormDataFromParams(params),
            formSchemaTyped,
          );
          const withSticky = applyStickyDefaults(withTokens, relevantSticky);
          console.log('Preloading initialization form values:', withSticky);
          setData(prepareRootObservationData(withSticky, formSchemaTyped));
        } else {
          const defaultData = applySchemaDefaultTokens(
            initialFormDataFromParams(params),
            formSchemaTyped,
          );
          console.log('Preloading initialization form values:', defaultData);
          setData(prepareRootObservationData(defaultData, formSchemaTyped));
        }

        console.log('Form params (if any, beyond schemas/data):', params);
        setLoadError(null); // Clear any previous load errors

        if (
          window.ReactNativeWebView &&
          window.ReactNativeWebView.postMessage
        ) {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({
              type: 'formplayerInitialized',
              formType: receivedFormType,
              status: 'success',
            }),
          );
        }
        setIsLoading(false);
        isLoadingRef.current = false;
      } catch (error) {
        console.error('Error initializing form:', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Unknown error during form initialization';
        setLoadError(`Error initializing form: ${errorMessage}`);
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    },
    [
      setFormInitData,
      setDraftSessionKey,
      setSchema,
      setUISchema,
      setData,
      setLoadError,
      setIsLoading,
    ],
  ); // isLoadingRef is a ref, not needed in deps

  // Handler for data received via window.onFormInit
  const handleFormInitByNative = useCallback(
    (initData: FormInitData) => {
      console.log('Received onFormInit event with data:', initData);

      try {
        const { formType: receivedFormType, savedData, formSchema } = initData;

        if (!receivedFormType) {
          console.error(
            'formType is crucial and was not provided in onFormInit. Cannot proceed.',
          );
          setLoadError('Form ID is missing. Cannot initialize form.');
          if (
            window.ReactNativeWebView &&
            window.ReactNativeWebView.postMessage
          ) {
            window.ReactNativeWebView.postMessage(
              JSON.stringify({
                type: 'formplayerError',
                formType: receivedFormType,
                message: 'formType missing in onFormInit',
              }),
            );
          }
          return; // Exit early
        }

        // Check if this is a new form (no savedData) and if drafts exist
        if (
          shouldOfferDraftSelector(
            {
              subObservationMode: initData.subObservationMode,
              skipDraftSelection: initData.skipDraftSelection,
              returnOnly: (initData as FormInitData & { returnOnly?: boolean })
                .returnOnly,
            },
            savedData,
          )
        ) {
          const availableDrafts = draftService.getDraftsForForm(
            receivedFormType,
            (formSchema as any)?.version,
          );
          if (availableDrafts.length > 0) {
            console.log(
              `Found ${availableDrafts.length} draft(s) for form ${receivedFormType}, showing draft selector`,
            );
            // Apply theme from params so draft selector respects light/dark mode
            const params = initData.params;
            const isDarkMode = params?.darkMode === true;
            setDarkMode(isDarkMode);
            if (params?.themeColors && typeof params.themeColors === 'object') {
              setCustomThemeColors(params.themeColors as CustomThemeColors);
            }
            setPendingFormInit(initData);
            setShowDraftSelector(true);
            setIsLoading(false);
            isLoadingRef.current = false;
            return { status: 'draft_selector_shown' }; // Don't proceed with normal initialization
          }
        }

        // Proceed with normal form initialization
        initializeForm(initData);
        return { status: 'ok' };
      } catch (error) {
        console.error('Error processing onFormInit data:', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Unknown error during form initialization';
        setLoadError(`Error processing form data: ${errorMessage}`);
        if (
          window.ReactNativeWebView &&
          window.ReactNativeWebView.postMessage
        ) {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({
              type: 'formplayerError',
              formType: initData?.formType,
              status: 'error',
              message: errorMessage,
            }),
          );
        }
        setIsLoading(false);
        isLoadingRef.current = false;
        return { status: 'error' };
      }
    },
    [initializeForm],
  );

  // Effect for initializing form via window.onFormInit
  useEffect(() => {
    // Ensure we only register onFormInit and signal readiness once per WebView lifecycle
    const globalAny = window as any;
    if (globalAny.__formplayerOnInitRegistered) {
      console.log(
        'window.onFormInit already registered for this WebView lifecycle, skipping re-registration.',
      );
      return;
    }

    globalAny.__formplayerOnInitRegistered = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    isLoadingRef.current = true;

    console.log('Registering window.onFormInit handler.');
    globalAny.onFormInit = handleFormInitByNative;

    // Signal to native that the WebView is ready to receive onFormInit
    console.log(
      'Signaling readiness to native host (formplayerReadyToReceiveInit).',
    );
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: 'formplayerReadyToReceiveInit',
        }),
      );
    } else {
      console.warn(
        'ReactNativeWebView.postMessage not available. Cannot signal readiness.',
      );
      console.log('Debug - NODE_ENV:', process.env.NODE_ENV);
      console.log('Debug - isMockActive():', isMockActive());
      console.log('Debug - isLoadingRef.current:', isLoadingRef.current);

      // Potentially set an error or handle standalone mode if WebView context isn't available
      // For example, if running in a standard browser for development
      if (isLoadingRef.current) {
        // Avoid setting error if already handled by timeout or success
        if (isMockActive()) {
          console.log(
            'Development mode: WebView mock is active, continuing without error',
          );
          // Don't set error in development mode when mock is active
        } else {
          console.log(
            'Setting error message because mock is not active or not in development',
          );
          setLoadError(
            'Cannot communicate with native host. Formplayer might be running in a standalone browser.',
          );
          setIsLoading(false);
          isLoadingRef.current = false;
        }
      }
    }

    // Timeout logic: if onFormInit is not called by native side
    // Note: This timeout often fires as a false positive when the form is actually loading successfully.
    // We use a longer timeout (20s) and only show error after additional delay to reduce false positives.
    const initTimeout = setTimeout(() => {
      if (isLoadingRef.current) {
        // Only log a debug message - don't show warning to user yet
        // The form may still be loading successfully
        if (process.env.NODE_ENV === 'development') {
          console.debug(
            '[Formplayer] onFormInit not yet received (timeout: 20s). Still waiting...',
          );
        }
        // Only show error if we're still loading after an additional delay
        // This prevents false positives when form loads successfully but slightly delayed
        setTimeout(() => {
          if (isLoadingRef.current) {
            // Only now show error - form truly failed to load
            console.warn(
              '[Formplayer] onFormInit timeout: Form failed to initialize after extended wait.',
            );
            setLoadError(
              'Failed to initialize form: No data received from native host. Please try again.',
            );
            setIsLoading(false);
            isLoadingRef.current = false;
            if (
              window.ReactNativeWebView &&
              window.ReactNativeWebView.postMessage
            ) {
              window.ReactNativeWebView.postMessage(
                JSON.stringify({
                  type: 'error',
                  message:
                    'Initialization timeout in WebView: onFormInit not called.',
                }),
              );
            }
          }
        }, 5000); // Additional 5 seconds before showing actual error
      }
    }, 20000); // Increased to 20 seconds to reduce false positives

    // Cleanup function when component unmounts
    return () => {
      clearTimeout(initTimeout);
      // Intentionally do not clear __formplayerOnInitRegistered so that we do not
      // re-register handlers or resend readiness within the same WebView lifecycle.
      if (globalAny.onFormInit === handleFormInitByNative) {
        globalAny.onFormInit = undefined;
        console.log('Unregistered window.onFormInit handler.');
      }
    };
  }, [handleFormInitByNative]); // Dependency: re-run if handleFormInitByNative changes

  // Attachment handling is now fully encapsulated within individual components
  // using the Promise-based media/action APIs exposed by Formulus.

  // Create AJV instance with extension definitions support
  const ajv = useMemo(() => {
    const instance = new Ajv({
      allErrors: true,
      strict: false, // Allow custom keywords like x-formulus-validation
      $data: true,
    });
    addErrors(instance);
    addFormats(instance);

    // Add custom format validators
    instance.addFormat('photo', () => true); // Accept any value for photo format
    instance.addFormat('qrcode', () => true); // Accept any value for qrcode format
    instance.addFormat('signature', () => true); // Accept any value for signature format
    instance.addFormat('select_file', () => true); // Accept any value for file selection format
    instance.addFormat('audio', () => true); // Accept any value for audio format
    instance.addFormat('gps', () => true); // Accept any value for GPS format
    instance.addFormat('video', () => true); // Accept any value for video format
    instance.addFormat('adate', (data: any) => {
      // Allow null, undefined, or empty string (for optional fields)
      if (data === null || data === undefined || data === '') {
        return true;
      }
      // Validate YYYY-MM-DD format (may contain ?? for unknown parts)
      const dateRegex = /^(\d{4}|\?\?\?\?)-(\d{2}|\?\?)-(\d{2}|\?\?)$/;
      return typeof data === 'string' && dateRegex.test(data);
    });
    instance.addFormat('sub-observation', () => true);

    // Register custom question type formats with AJV
    // Custom question types use "format": "formatName" in schemas (not "type")
    // This is required because JSON Schema only allows standard types in the "type" field
    if (customTypeFormats.length > 0) {
      customTypeFormats.forEach(formatName => {
        // Register as format so AJV accepts "format": "formatName" in schemas
        instance.addFormat(formatName, () => true);
      });
      console.log(
        `[Formplayer] Registered ${customTypeFormats.length} custom question type format(s) with AJV`,
      );
    }

    // Add extension definitions to AJV for $ref support
    if (Object.keys(extensionDefinitions).length > 0) {
      // Add each definition individually so $ref can reference them
      for (const [key, definition] of Object.entries(extensionDefinitions)) {
        instance.addSchema(definition, `#/definitions/${key}`);
      }
    }

    return instance;
  }, [extensionDefinitions, customTypeFormats]);

  // Set up event listeners for navigation and finalization
  useEffect(() => {
    const handleNavigateToError = (event: CustomEvent) => {
      if (!uischema) return;

      const path = event.detail.path;
      const field = path.split('/').pop();
      const screens = uischema.elements;

      for (let i = 0; i < screens.length; i++) {
        const screen = screens[i];
        // Skip the Finalize screen
        if (screen.type === 'Finalize') continue;

        // Type guard to ensure elements exists
        if ('elements' in screen && screen.elements) {
          if (screen.elements.some((el: any) => el.scope?.includes(field))) {
            // Dispatch a custom event that SwipeLayoutWrapper will listen for
            const navigateEvent = new CustomEvent('navigateToPage', {
              detail: { page: i },
            });
            window.dispatchEvent(navigateEvent);
            break;
          }
        }
      }
    };

    const handleShowValidation = () => {
      // Idempotent: once shown, stays shown for the session.
      setValidationMode(prev =>
        prev === 'ValidateAndHide' ? 'ValidateAndShow' : prev,
      );
    };

    const handleFinalizeForm = (event: Event) => {
      // Reaching finalize is a meaningful checkpoint: ensure validation is shown.
      handleShowValidation();
      // Prefer the payload from the FinalizeRenderer if available
      const customEvent = event as CustomEvent<{
        formInitData?: FormInitData;
        data?: FormData;
      }>;
      const payloadFormInit = customEvent.detail?.formInitData || formInitData;
      const rawPayload = customEvent.detail?.data || data;

      if (!payloadFormInit) {
        console.error(
          '[App.tsx] Cannot finalize form: formInitData is missing',
        );
        setSubmitError(
          'Cannot submit form because initialization data is missing.',
        );
        return;
      }

      const rootPayload = prepareRootObservationData(rawPayload, schema);
      const { errors: finalizeValidatorErrors, data: payloadData } =
        runCustomValidatorsAndRefreshData(
          uischema ?? undefined,
          schema ?? undefined,
          rootPayload as Record<string, unknown>,
          ajv,
        );

      if (finalizeValidatorErrors.length > 0) {
        setCustomValidatorErrors(finalizeValidatorErrors);
        setSubmitError(
          'Cannot submit form until custom validation errors are resolved.',
        );
        return;
      }

      console.log('[App.tsx] Submitting form data:', payloadData);
      formulusClient.current
        .submitObservationWithContext(payloadFormInit, payloadData)
        .then(() => {
          if (payloadFormInit.observationId != null) {
            draftService.deleteDraftsForFormInstance(
              payloadFormInit.formType,
              payloadFormInit.observationId,
            );
          } else if (draftSessionKey) {
            draftService.deleteDraftForNewObservationSession(
              payloadFormInit.formType,
              draftSessionKey,
            );
          }
          // Persist sticky field values for next new observation of this form.
          if (!isSubObservationSession(payloadFormInit) && uischema) {
            const formVersion = (schema as { version?: string } | null)
              ?.version;
            const stickyPaths = collectStickyFieldPaths(uischema);
            const stickyValues = extractStickyValues(payloadData, stickyPaths);
            if (Object.keys(stickyValues).length > 0) {
              stickyService.saveStickyValues(
                payloadFormInit.formType,
                formVersion,
                stickyValues,
              );
            }
          }
          setSubmitError(null);
          setShowFinalizeMessage(true);
        })
        .catch(error => {
          console.error('[App.tsx] Error submitting form:', error);
          setSubmitError('Failed to submit form. Please try again.');
        });
    };

    window.addEventListener(
      'navigateToError',
      handleNavigateToError as EventListener,
    );
    window.addEventListener(
      'finalizeForm',
      handleFinalizeForm as EventListener,
    );
    window.addEventListener(
      'formShowValidation',
      handleShowValidation as EventListener,
    );

    return () => {
      window.removeEventListener(
        'navigateToError',
        handleNavigateToError as EventListener,
      );
      window.removeEventListener(
        'finalizeForm',
        handleFinalizeForm as EventListener,
      );
      window.removeEventListener(
        'formShowValidation',
        handleShowValidation as EventListener,
      );
    };
  }, [data, formInitData, draftSessionKey, uischema, schema, ajv]); // Include all dependencies

  // Handler for resuming a draft
  const handleResumeDraft = useCallback(
    (draftId: string) => {
      const draft = draftService.getDraft(draftId);
      if (draft && pendingFormInit) {
        console.log('Resuming draft:', draftId, draft);

        // Create new FormInitData with draft data as savedData
        const initDataWithDraft: FormInitData = {
          ...pendingFormInit,
          savedData: draft.data,
        };

        // Initialize form with draft data (keep the same draft row when saving)
        initializeForm(
          initDataWithDraft,
          draft.draftSessionKey ?? `legacy_${draft.id}`,
        );

        // Hide draft selector
        setShowDraftSelector(false);
        setPendingFormInit(null);
      }
    },
    [pendingFormInit, initializeForm],
  );

  // Handler for starting a new form (ignoring drafts)
  const handleStartNewForm = useCallback(() => {
    if (pendingFormInit) {
      console.log('Starting new form, ignoring drafts');
      initializeForm(pendingFormInit, newDraftSessionKey());
      setShowDraftSelector(false);
      setPendingFormInit(null);
    }
  }, [pendingFormInit, initializeForm]);

  const handleDataChange = useCallback(
    ({ data: newData }: { data: FormData }) => {
      const { errors, data: refreshedData } = runCustomValidatorsAndRefreshData(
        uischema ?? undefined,
        schema ?? undefined,
        newData as Record<string, unknown>,
        ajv,
      );

      setData(refreshedData);
      setCustomValidatorErrors(errors);

      // Save draft data whenever form data changes (skip embedded sub-observation sessions)
      if (formInitData && !isSubObservationSession(formInitData)) {
        draftService.saveDraft(
          formInitData.formType,
          refreshedData,
          formInitData,
          draftSessionKey,
        );
      }
    },
    [formInitData, draftSessionKey, uischema, schema, ajv],
  );

  // Create dynamic theme based on dark mode preference and custom app colors.
  // When a custom app provides themeColors, they override the default palette
  // so that form controls (buttons, inputs, etc.) match the app's branding.
  const currentTheme = useMemo(() => {
    return createTheme(
      getThemeOptions(darkMode ? 'dark' : 'light', customThemeColors),
    );
  }, [darkMode, customThemeColors]);

  // Set CSS custom properties for use in CSS files and by ODE Button.
  // When a custom app provides themeColors, use those so buttons and other
  // token-based UI match the app branding; otherwise use default tokens.
  useEffect(() => {
    const root = document.documentElement;
    const primary =
      customThemeColors?.primary ?? tokens.color.brand.primary[500];
    const onPrimary =
      customThemeColors?.onPrimary ?? tokens.color.neutral.white;
    root.style.setProperty('--ode-color-brand-primary-500', primary);
    root.style.setProperty('--ode-color-neutral-white', onPrimary);
    root.style.setProperty(
      '--ode-color-neutral-200',
      customThemeColors?.onSurface ?? tokens.color.neutral[200],
    );
    root.style.setProperty(
      '--ode-color-neutral-50',
      customThemeColors?.surface ?? tokens.color.neutral[50],
    );
  }, [customThemeColors]);

  // Show draft selector if we have pending form init and available drafts.
  // Wrap in ThemeProvider so DraftSelector gets the same theme (dark mode + custom colors).
  if (showDraftSelector && pendingFormInit) {
    return (
      <ThemeProvider theme={currentTheme}>
        <DraftSelector
          formType={pendingFormInit.formType}
          formVersion={(pendingFormInit.formSchema as any)?.version}
          onResumeDraft={handleResumeDraft}
          onStartNew={handleStartNewForm}
          fullScreen={true}
        />
      </ThemeProvider>
    );
  }

  // Render loading state or error if needed
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading form...
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          Waiting for data from Formulus...
        </Typography>
      </Box>
    );
  }

  if (loadError || !schema || !uischema) {
    if (loadError) {
      console.error('[Formplayer] Load error:', loadError);
      // Show the actual error so user knows what went wrong (not blank white screen)
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            p: 3,
            backgroundColor: 'background.paper',
          }}>
          <Typography
            variant="h6"
            color="error"
            sx={{ mb: 2, textAlign: 'center' }}>
            Error Loading Form
          </Typography>
          <Typography
            variant="body2"
            sx={{ textAlign: 'center', color: 'text.secondary' }}>
            {loadError}
          </Typography>
        </Box>
      );
    }
    if (!schema) {
      console.warn('[Formplayer] Schema not loaded yet');
    }
    if (!uischema) {
      console.warn('[Formplayer] UI schema not loaded yet');
    }
    // Still waiting for schema/uischema - show loading
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading form...
        </Typography>
      </Box>
    );
  }

  // Log render with current state
  console.log('Rendering form with:', {
    schemaType: schema?.type || 'MISSING',
    uiSchemaType: uischema?.type || 'MISSING',
    dataKeys: Object.keys(data),
    formType: formInitData?.formType,
    darkMode: darkMode,
  });

  return (
    <ThemeProvider theme={currentTheme}>
      <FormContext.Provider value={{ formInitData, draftSessionKey }}>
        <div
          className="App"
          style={{
            display: 'flex',
            height: '100%', // Fill WebView; host resizes for keyboard (adjustResize)
            width: '100%',
            backgroundColor: currentTheme.palette.background.default, // Ensure dark background
            color: currentTheme.palette.text.primary,
          }}>
          {/* Main app content - 60% width in development mode */}
          <div
            style={{
              width: process.env.NODE_ENV === 'development' ? '60%' : '100%',
              overflow: 'hidden', // Prevent outer scrolling - FormLayout handles scrolling internally
              padding: tokens.spacing[1],
              boxSizing: 'border-box',
              height: '100%', // Ensure it takes full height
              backgroundColor: 'transparent', // Use theme background
            }}>
            <ErrorBoundary>
              {loadError ? (
                <Box
                  sx={{
                    padding: tokens.spacing[5],
                    backgroundColor: 'error.light',
                    border: `${tokens.border.width.thin} solid`,
                    borderColor: 'error.main',
                    borderRadius: tokens.border.radius.md, // Match button border radius
                    color: 'error.dark',
                  }}>
                  <Typography variant="h6" color="error">
                    Error Loading Form
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {loadError}
                  </Typography>
                </Box>
              ) : (
                <>
                  <FormEvaluationProvider functions={extensionFunctions}>
                    <JsonForms
                      schema={schema}
                      uischema={uischema}
                      data={data}
                      renderers={[
                        ...shellMaterialRenderers,
                        ...materialRenderers,
                        ...customRenderers,
                        ...customTypeRenderers, // Custom question types from custom_app
                        ...extensionRenderers, // Extension renderers (highest priority)
                      ]}
                      cells={materialCells}
                      onChange={handleDataChange}
                      validationMode={validationMode}
                      ajv={ajv}
                      additionalErrors={customValidatorErrors}
                    />
                  </FormEvaluationProvider>
                  {/* Success Snackbar */}
                  <Snackbar
                    open={showFinalizeMessage}
                    autoHideDuration={6000}
                    onClose={() => setShowFinalizeMessage(false)}>
                    <Alert
                      onClose={() => setShowFinalizeMessage(false)}
                      severity="info">
                      Form submitted successfully!
                    </Alert>
                  </Snackbar>
                  {/* Error Snackbar for submit failures */}
                  <Snackbar
                    open={Boolean(submitError)}
                    autoHideDuration={6000}
                    onClose={() => setSubmitError(null)}>
                    <Alert
                      onClose={() => setSubmitError(null)}
                      severity="error">
                      {submitError}
                    </Alert>
                  </Snackbar>
                </>
              )}
            </ErrorBoundary>
          </div>

          {/* Development testbed - 40% width in development mode (lazy-loaded, not in production bundle) */}
          {DevTestbedLazy && (
            <div
              style={{
                width: '40%',
                borderLeft: `${tokens.border.width.medium} solid ${tokens.color.neutral[200]}`,
                backgroundColor: tokens.color.neutral[50],
              }}>
              <ErrorBoundary>
                <React.Suspense fallback={null}>
                  <DevTestbedLazy isVisible={true} />
                </React.Suspense>
              </ErrorBoundary>
            </div>
          )}
        </div>
      </FormContext.Provider>
    </ThemeProvider>
  );
}

export default App;
