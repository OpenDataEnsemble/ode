import React from 'react';
import { Box, Button, List, ListItem, ListItemText, Typography, Paper } from '@mui/material';
import { JsonFormsRendererRegistryEntry } from '@jsonforms/core';
import { withJsonFormsControlProps, useJsonForms } from '@jsonforms/react';
import { ControlProps } from '@jsonforms/core';
import { ErrorObject } from 'ajv';
import { useFormContext } from './App';

const FinalizeRenderer = ({ 
  schema, 
  uischema, 
  data, 
  handleChange, 
  path, 
  renderers, 
  cells, 
  enabled
}: ControlProps) => {
  const { core } = useJsonForms();
  const errors = core?.errors || [];
  const { formInitData } = useFormContext();
  
  // Log the props to inspect their structure
  console.log('JsonForms props:', { errors, data, path, cells, schema });
  
  const formatErrorPath = (path: string) => {
    // Remove leading slash and convert to readable format
    return path.replace(/^\//, '').replace(/\//g, ' > ');
  };

  const formatErrorMessage = (error: ErrorObject) => {
    const path = formatErrorPath(error.instancePath);
    // Check if there's a custom error message in the error object
    const customMessage = (error as any).params?.errorMessage;
    // Title case the path and add spaces before capitalized letters
    const formattedPath = path ? path
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .replace(/([A-Z])/g, ' $1')
      .trim() : '';
    return formattedPath ? `${formattedPath} ${customMessage || error.message}` : customMessage || error.message;
  };

  const hasErrors = Array.isArray(errors) && errors.length > 0;

  const handleErrorClick = (path: string) => {
    // Dispatch a custom event that SwipeLayoutRenderer will listen for
    const event = new CustomEvent('navigateToError', { 
      detail: { path } 
    });
    window.dispatchEvent(event);
  };

  const handleFinalize = () => {
    if (!formInitData) {
      console.error('formInitData is not available from context, cannot submit form');
      return;
    }
    if (!hasErrors) {
      console.log('Dispatching finalizeForm event to submit data via App.tsx');
      const event = new CustomEvent('finalizeForm', { detail: { formInitData, data } });
      window.dispatchEvent(event);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Review and Finalize
      </Typography>
      
      {hasErrors ? (
        <>
          <Typography variant="subtitle1" color="error" gutterBottom>
            Please fix the following errors before finalizing:
          </Typography>
          <Paper sx={{ mb: 3 }}>
            <List>
              {errors.map((error: ErrorObject, index: number) => (
                <ListItem 
                  key={index}
                  component="div"
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleErrorClick(error.instancePath)}
                >
                  <ListItemText 
                    primary={formatErrorMessage(error)}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </>
      ) : (
        <Typography variant="subtitle1" color="success.main" gutterBottom>
          All validations passed! You can now finalize your submission.
        </Typography>
      )}

      <Button
        variant="contained"
        color="primary"
        size="large"
        onClick={handleFinalize}
        disabled={Boolean(hasErrors)}
      >
        Finalize
      </Button>
    </Box>
  );
};

export const finalizeTester = (uischema: any) => uischema.type === 'Finalize' ? 3 : -1;

export const finalizeRenderer: JsonFormsRendererRegistryEntry = {
  tester: finalizeTester,
  renderer: withJsonFormsControlProps(FinalizeRenderer),
}; 