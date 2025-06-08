import React, { useCallback, useState, useEffect, useRef } from "react";
import "./App.css";
import { JsonForms } from "@jsonforms/react";
import { materialRenderers, materialCells } from "@jsonforms/material-renderers";
import { JsonSchema7 } from "@jsonforms/core";
import { Alert, Snackbar, CircularProgress, Box, Typography } from '@mui/material';
import Ajv from 'ajv';
import addErrors from 'ajv-errors';
import addFormats from 'ajv-formats';

// Import the FormulusInterface client
import FormulusClient from "./FormulusInterface";

import SwipeLayoutRenderer, { swipeLayoutTester, groupAsSwipeLayoutTester } from "./SwipeLayoutRenderer";
import { finalizeRenderer } from "./FinalizeRenderer";
import { RankedTester } from "@jsonforms/core";

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

// Interface for the data structure passed to window.onFormInit
export interface FormInitData {
  formId: string;
  params?: {
    defaultData?: FormData;
    [key: string]: any; // Other params that might be passed
  };
  savedData?: FormData;
  formSchema: FormSchema; // Assuming FormSchema is already defined from @jsonforms/core or similar
  uiSchema?: FormUISchema; // Assuming FormUISchema is already defined
}

const customRenderers = [
  ...materialRenderers,
  { tester: swipeLayoutTester, renderer: SwipeLayoutRenderer, isSwipeRenderer: true },
  { tester: groupAsSwipeLayoutTester, renderer: SwipeLayoutRenderer, isSwipeRenderer: true },
  finalizeRenderer
];

function App() {
  // State for form data, schema, and UI schema
  const [data, setData] = useState<FormData>({});
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [uischema, setUISchema] = useState<FormUISchema | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showFinalizeMessage, setShowFinalizeMessage] = useState(false);
  const [formId, setFormId] = useState<string | null>(null);
  
  // Reference to the FormulusClient instance and loading state
  const formulusClient = useRef<FormulusClient>(FormulusClient.getInstance());
  const isLoadingRef = useRef<boolean>(true); // Use a ref to track loading state for the timeout

  // Handler for data received via window.onFormInit
  const handleFormInitByNative = useCallback((initData: FormInitData) => {
    console.log('Received onFormInit event with data:', initData);

    try {
      const { formId: receivedFormId, params, savedData, formSchema, uiSchema } = initData;

      if (!receivedFormId) {
        console.error('formId is crucial and was not provided in onFormInit. Cannot proceed.');
        setLoadError('Form ID is missing. Cannot initialize form.');
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'formplayerError', formId: receivedFormId, message: 'formId missing in onFormInit' }));
        }
        return; // Exit early
      }
      setFormId(receivedFormId);

      if (!formSchema) {
        console.warn('formSchema was not provided. Form rendering might fail or be incomplete.');
        setLoadError('Form schema is missing. Form rendering might fail or be incomplete.');
        setSchema({} as FormSchema); // Set to empty schema or handle as per requirements
        // uiSchema might also need a default or be cleared
        setUISchema({} as FormUISchema);
      } else {
        setSchema(formSchema as FormSchema);
        setUISchema(uiSchema || {} as FormUISchema); // Fallback to empty object if uiSchema is undefined
      }

      if (savedData && Object.keys(savedData).length > 0) {
        console.log('Preloading saved data:', savedData);
        setData(savedData as FormData);
      } else {
        const defaultData = params?.defaultData || {};
        console.log('Preloading initialization form values:', defaultData);
        setData(defaultData);
      }

      console.log('Form params (if any, beyond schemas/data):', params);
      setLoadError(null); // Clear any previous load errors

      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'formplayerInitialized',
          formId: receivedFormId,
          status: 'success'
        }));
      }
    } catch (error) {
      console.error('Error processing onFormInit data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during form initialization';
      setLoadError(`Error processing form data: ${errorMessage}`);
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'formplayerError',
          formId: initData?.formId, // Attempt to include formId if available
          status: 'error',
          message: errorMessage
        }));
      }
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [setFormId, setSchema, setUISchema, setData, setLoadError, setIsLoading]); // isLoadingRef is a ref, not needed in deps

  // Effect for initializing form via window.onFormInit
  useEffect(() => {
    setIsLoading(true);
    isLoadingRef.current = true;

    console.log('Registering window.onFormInit handler.');
    (window as any).onFormInit = handleFormInitByNative;

    // Signal to native that the WebView is ready to receive onFormInit
    console.log('Signaling readiness to native host (formplayerReadyToReceiveInit).');
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'formplayerReadyToReceiveInit'
      }));
    } else {
      console.warn('ReactNativeWebView.postMessage not available. Cannot signal readiness.');
      // Potentially set an error or handle standalone mode if WebView context isn't available
      // For example, if running in a standard browser for development
      if (isLoadingRef.current) { // Avoid setting error if already handled by timeout or success
          setLoadError('Cannot communicate with native host. Formplayer might be running in a standalone browser.');
          setIsLoading(false);
          isLoadingRef.current = false;
      }
    }

    // Timeout logic: if onFormInit is not called by native side
    const initTimeout = setTimeout(() => {
      if (isLoadingRef.current) { // Check ref to see if still loading
        console.warn('onFormInit was not called within timeout period (10s).');
        setLoadError('Failed to initialize form: No data received from native host. Please try again.');
        setIsLoading(false);
        isLoadingRef.current = false;
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            message: 'Initialization timeout in WebView: onFormInit not called.'
          }));
        }
      }
    }, 10000); // 10 second timeout

    // Cleanup function when component unmounts
    return () => {
      clearTimeout(initTimeout);
      if ((window as any).onFormInit === handleFormInitByNative) {
        (window as any).onFormInit = undefined;
        console.log('Unregistered window.onFormInit handler.');
      }
    };
  }, [handleFormInitByNative]); // Dependency: re-run if handleFormInitByNative changes

  // Register for attachment ready events
  useEffect(() => {
    console.log('Formplayer: Executing initialization code');
    // Check if Formplayer has already been initialized in this WebView session
    if ((window as any).__formplayerAppInitialized) {
      console.log('Already initialized by this instance, skipping effect.');
      return;
    }
    window.onFormulusReady = () => {
      console.log('Formplayer: onFormulusReady called');
    };

    formulusClient.current.onAttachmentReady((attachmentData) => {
      console.debug('%c Attachment ready:', 'background: #FF9800; color: white; padding: 2px 5px; border-radius: 2px;', attachmentData);
      
      try {
        // Validate attachment data
        if (!attachmentData) {
          throw new Error('Attachment data is null or undefined');
        }
        
        // Handle different types of attachments
        const { fieldId, type, ...attachmentProps } = attachmentData;
        
        if (!fieldId) {
          throw new Error('Field ID is missing in attachment data');
        }
        
        if (!type) {
          throw new Error('Attachment type is missing');
        }
      
      // Update the form data with the attachment information
      setData(prevData => {
        // Create a new data object with the same structure
        const newData = { ...prevData };
        
        // Handle the attachment data based on its type
        // We'll use a type assertion here since we're dealing with dynamic field names
        // that aren't part of the static type definition
        const updatedData = newData as unknown as Record<string, any>;
        
        // Set the field value based on the attachment type
        switch (type) {
          case 'image':
          case 'file':
          case 'audio':
          case 'signature':
            updatedData[fieldId] = attachmentProps.uri;
            break;
          case 'location':
            updatedData[fieldId] = attachmentProps.coords;
            break;
          case 'intent':
          case 'subform':
          case 'ml_result':
            updatedData[fieldId] = attachmentProps.data;
            break;
          case 'biometric':
            updatedData[fieldId] = attachmentProps.verified;
            break;
          // For connectivity and sync status, these might be handled differently
          case 'connectivity':
          case 'sync':
            // These might update global state rather than form fields
            break;
        }
        
        // Convert back to the expected type
        return newData as FormData;
      });
      } catch (error) {
        console.error('Error processing attachment data:', error);
      }
    });

    // Set the flag to indicate initialization is complete for this session
    (window as any).__formplayerAppInitialized = true;
    console.log('__formplayerAppInitialized flag set to true.');
  }, []);

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
              detail: { page: i } 
            });
            window.dispatchEvent(navigateEvent);
            break;
          }
        }
      }
    };

    const handleFinalizeForm = () => {
      // Submit the form data to the Formulus RN app
      if (formId) {
        formulusClient.current.submitForm(data);
      }
      setShowFinalizeMessage(true);
    };

    window.addEventListener('navigateToError', handleNavigateToError as EventListener);
    window.addEventListener('finalizeForm', handleFinalizeForm as EventListener);
    
    return () => {
      window.removeEventListener('navigateToError', handleNavigateToError as EventListener);
      window.removeEventListener('finalizeForm', handleFinalizeForm as EventListener);
    };
  }, [data, formId, uischema, schema]);  // Include all dependencies

  const handleDataChange = useCallback(({ data }: { data: FormData }) => {
    setData(data);
    
    // Save partial data to the Formulus RN app whenever data changes
    if (formId) {
      formulusClient.current.savePartial(data);
    }
  }, [formId]);

  const ajv = new Ajv({ allErrors: true });
  addErrors(ajv);
  addFormats(ajv);
  
  // Render loading state or error if needed
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
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
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Typography variant="h6" color="error">
          {loadError || 'Failed to load form'}
        </Typography>
        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, maxWidth: '80%' }}>
          <Typography variant="subtitle2">Debug Information:</Typography>
          <Typography variant="body2" component="pre" sx={{ mt: 1, p: 1, bgcolor: '#f5f5f5', overflow: 'auto', maxHeight: '200px' }}>
            {JSON.stringify({
              hasSchema: !!schema,
              hasUISchema: !!uischema,
              schemaType: schema?.type,
              uiSchemaType: uischema?.type,
              error: loadError
            }, null, 2)}
          </Typography>
        </Box>
      </Box>
    );
  }
  
  // Log render with current state
  console.log('%c Rendering form with:', 'background: #9C27B0; color: white; padding: 2px 5px; border-radius: 2px;', {
    schemaType: schema?.type || "MISSING",
    uiSchemaType: uischema?.type || "MISSING",
    dataKeys: Object.keys(data),
    formId
  });  

  return (
    <div className="App">
      <JsonForms
        schema={schema}
        uischema={uischema}
        data={data}
        renderers={customRenderers}
        cells={materialCells}
        onChange={handleDataChange}
        validationMode="ValidateAndShow"
        ajv={ajv}
      />
      <Snackbar 
        open={showFinalizeMessage} 
        autoHideDuration={6000} 
        onClose={() => setShowFinalizeMessage(false)}
      >
        <Alert onClose={() => setShowFinalizeMessage(false)} severity="info">
          Form submitted successfully!
        </Alert>
      </Snackbar>
    </div>
  );
}

export default App;
