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

import SwipeLayoutRenderer from "./SwipeLayoutRenderer";
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

export const swipeLayoutTester: RankedTester = (uischema) => uischema.type === "SwipeLayout" ? 3 : -1;

const customRenderers = [
  ...materialRenderers,
  { tester: swipeLayoutTester, renderer: SwipeLayoutRenderer, isSwipeRenderer: true },
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

  // Effect for form initialization
  useEffect(() => {
    setIsLoading(true);
    isLoadingRef.current = true; // Set the ref to true as well
    
    // Register for form initialization data
    formulusClient.current.onFormInit((formData) => {
      console.log('%c Received form initialization data:', 'background: #4CAF50; color: white; padding: 2px 5px; border-radius: 2px;', formData);
      
      try {
        // Validate formData structure
        if (!formData) {
          throw new Error('Form data is null or undefined');
        }
        
        if (!formData.formId) {
          console.warn('Form ID is missing in the initialization data');
        }
        
        // Set the form ID
        setFormId(formData.formId);
        
        // Log params for debugging
        console.log('Form params:', formData.params);
        
        // Get schema and UI schema from params
        const { schema: formSchema, uischema: formUISchema } = formData.params || {};
        
        // Validate schema and UI schema
        if (!formData.params) {
          throw new Error('Form params are missing');
        }
        
        if (formSchema && formUISchema) {
          // Log schema and UI schema structure
          console.log('Schema structure:', {
            type: formSchema.type,
            properties: Object.keys(formSchema.properties || {}),
            required: formSchema.required
          });
          
          console.log('UI schema structure:', {
            type: formUISchema.type,
            elementsCount: formUISchema.elements?.length || 0
          });
          
          // Set the schema and UI schema
          setSchema(formSchema as FormSchema);
          setUISchema(formUISchema as FormUISchema);
          
          // Handle saved data
          if (formData.savedData && Object.keys(formData.savedData).length > 0) {
            console.log('Using saved data:', formData.savedData);
            setData(formData.savedData as FormData);
          } else {
            // Otherwise, use empty data or default data if provided in params
            const defaultData = formData.params.defaultData || {};
            console.log('Using default data:', defaultData);
            setData(defaultData);
          }
          
          setLoadError(null);
        } else {
          // Handle missing schema or UI schema
          console.error('Missing schema or UI schema in form initialization data', {
            hasSchema: !!formSchema,
            hasUISchema: !!formUISchema
          });
          setLoadError('Missing form definition. Please contact support.');
        }
      } catch (error) {
        console.error('Error processing form initialization data:', error);
        setLoadError(`Error processing form data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
        isLoadingRef.current = false; // Update the ref when setting isLoading to false
      }
    });
    
    // Register for errors or timeout
    formulusClient.current.onFormulusReady(() => {
      console.log('%c Formulus interface is ready', 'background: #2196F3; color: white; padding: 2px 5px; border-radius: 2px;');
    });
    
    // Initialize the form - this will trigger the onFormInit callback
    formulusClient.current.initForm();
    
    // Set a timeout in case we don't get a response
    const timeout = setTimeout(() => {
      // Check the ref instead of the state to avoid closure issues
      if (isLoadingRef.current) {
        console.warn('Form initialization timed out');
        setLoadError('Failed to load form. Please try again later.');
        setIsLoading(false);
        isLoadingRef.current = false; // Update the ref as well
      } else {
        console.log('Form loaded successfully before timeout');
      }
    }, 10000); // 10 second timeout
    
    return () => clearTimeout(timeout);
  }, []);

  // Register for attachment ready events
  useEffect(() => {
    formulusClient.current.onAttachmentReady((attachmentData) => {
      console.log('%c Attachment ready:', 'background: #FF9800; color: white; padding: 2px 5px; border-radius: 2px;', attachmentData);
      
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
  }, [data, formId, uischema]);  // Include all dependencies

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
    schemaType: schema?.type,
    uiSchemaType: uischema?.type,
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
