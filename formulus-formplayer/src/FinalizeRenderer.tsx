import React, { useMemo } from 'react';
import { Box, Button, List, ListItem, ListItemText, Typography, Paper, Divider, Link } from '@mui/material';
import { JsonFormsRendererRegistryEntry } from '@jsonforms/core';
import { withJsonFormsControlProps, useJsonForms } from '@jsonforms/react';
import { ControlProps } from '@jsonforms/core';
import { ErrorObject } from 'ajv';
import { useFormContext } from './App';
import EditIcon from '@mui/icons-material/Edit';

interface SummaryItem {
  label: string;
  value: any;
  path: string;
  pageIndex: number;
  type?: string;
  format?: string;
}

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
  const fullSchema = core?.schema;
  const fullUISchema = formInitData?.uiSchema;
  
  // Helper function to get field label from schema
  const getFieldLabel = (fieldPath: string, fieldSchema: any): string => {
    if (!fieldSchema) return fieldPath;
    return fieldSchema.title || fieldSchema.description || fieldPath.split('/').pop() || fieldPath;
  };

  // Helper function to format field value based on type
  const formatFieldValue = (value: any, fieldSchema: any): string => {
    if (value === null || value === undefined || value === '') {
      return 'Not provided';
    }

    // Handle special formats
    if (fieldSchema?.format) {
      switch (fieldSchema.format) {
        case 'photo':
          if (typeof value === 'object' && value.uri) {
            return `Photo: ${value.filename || 'Captured'}`;
          }
          return 'Photo captured';
        case 'qrcode':
          if (typeof value === 'object' && value.data) {
            return `QR Code: ${value.data}`;
          }
          return typeof value === 'string' ? `QR Code: ${value}` : 'QR Code scanned';
        case 'signature':
          if (typeof value === 'object' && value.uri) {
            return 'Signature captured';
          }
          return 'Signature provided';
        case 'select_file':
          if (typeof value === 'object' && value.filename) {
            return `File: ${value.filename}`;
          }
          return 'File selected';
        case 'audio':
          if (typeof value === 'object' && value.filename) {
            const duration = value.metadata?.duration ? ` (${Math.round(value.metadata.duration)}s)` : '';
            return `Audio: ${value.filename}${duration}`;
          }
          return 'Audio recorded';
        case 'gps':
          if (typeof value === 'object' && value.latitude && value.longitude) {
            return `Location: ${value.latitude.toFixed(6)}, ${value.longitude.toFixed(6)}`;
          }
          return 'GPS location captured';
        case 'video':
          if (typeof value === 'object' && value.filename) {
            return `Video: ${value.filename}`;
          }
          return 'Video captured';
        case 'date':
          return new Date(value).toLocaleDateString();
        case 'date-time':
          return new Date(value).toLocaleString();
        case 'time':
          return value;
      }
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) return 'None';
      return value.map((item, idx) => {
        if (typeof item === 'object') {
          return `${idx + 1}. ${JSON.stringify(item)}`;
        }
        return String(item);
      }).join(', ');
    }

    // Handle objects
    if (typeof value === 'object') {
      // Check if it's a nested object with properties
      if (Object.keys(value).length === 0) return 'Empty';
      return JSON.stringify(value, null, 2);
    }

    // Handle booleans
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    // Default: convert to string
    return String(value);
  };


  // Helper function to find which page/screen a field is on
  const findFieldPageMemo = useMemo(() => {
    return (fieldPath: string): number => {
      if (!fullUISchema || !fullUISchema.elements) return -1;
      
      // Normalize the field path (remove #/properties/ prefix and convert / to .)
      const normalizePath = (path: string) => {
        return path.replace(/^#\/properties\//, '').replace(/\//g, '.');
      };
      
      const fieldName = normalizePath(fieldPath);
      const screens = fullUISchema.elements;
      
      for (let i = 0; i < screens.length; i++) {
        const screen = screens[i];
        if (screen.type === 'Finalize') continue;
        
        if ('elements' in screen && screen.elements) {
          const hasField = screen.elements.some((el: any) => {
            if (el.scope) {
              const scopePath = normalizePath(el.scope);
              // Exact match or field is nested under scope, or scope is nested under field
              return scopePath === fieldName || 
                     fieldName.startsWith(scopePath + '.') || 
                     scopePath.startsWith(fieldName + '.');
            }
            return false;
          });
          
          if (hasField) return i;
        }
      }
      
      return -1;
    };
  }, [fullUISchema]);

  // Extract all form fields and their values for summary
  const summaryItems = useMemo((): SummaryItem[] => {
    if (!fullSchema || !data || !fullSchema.properties) return [];
    
    const items: SummaryItem[] = [];
    
    const extractFields = (schemaObj: any, dataObj: any, basePath: string = '') => {
      if (!schemaObj || !schemaObj.properties) return;
      
      Object.keys(schemaObj.properties).forEach(key => {
        const fieldSchema = schemaObj.properties[key];
        const fieldPath = basePath ? `${basePath}/${key}` : key;
        const fieldValue = dataObj?.[key];
        const fullPath = `#/properties/${fieldPath}`;
        
        // Skip if value is empty (null, undefined, empty string, empty array, empty object)
        const isEmpty = 
          fieldValue === null || 
          fieldValue === undefined || 
          fieldValue === '' ||
          (Array.isArray(fieldValue) && fieldValue.length === 0) ||
          (typeof fieldValue === 'object' && !Array.isArray(fieldValue) && Object.keys(fieldValue).length === 0);
        
        if (isEmpty) {
          // Only include empty fields if they are required (to show what's missing)
          const isRequired = schemaObj.required?.includes(key);
          if (!isRequired) return;
        }
        
        // Handle nested objects
        if (fieldSchema.type === 'object' && fieldSchema.properties && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
          extractFields(fieldSchema, fieldValue, fieldPath);
        } else {
          // Add to summary
          const pageIndex = findFieldPageMemo(fullPath);
          items.push({
            label: getFieldLabel(fullPath, fieldSchema),
            value: fieldValue,
            path: fullPath,
            pageIndex,
            type: fieldSchema.type,
            format: fieldSchema.format
          });
        }
      });
    };
    
    extractFields(fullSchema, data);
    
    return items;
  }, [fullSchema, data, findFieldPageMemo]);

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

  const handleFieldEdit = (item: SummaryItem) => {
    if (item.pageIndex >= 0) {
      // Navigate to the page containing this field
      const navigateEvent = new CustomEvent('navigateToPage', { 
        detail: { page: item.pageIndex } 
      });
      window.dispatchEvent(navigateEvent);
    } else {
      // Fallback: try to navigate using the field path
      handleErrorClick(item.path);
    }
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
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
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

      {/* Summary Section */}
      {summaryItems.length > 0 && (
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mt: 2, mb: 1 }}>
            Form Summary
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
            Review all your entered data below. Click on any field to edit it.
          </Typography>
          <Paper 
            sx={{ 
              flex: 1, 
              overflow: 'auto', 
              p: 2,
              maxHeight: '100%'
            }}
          >
            <List sx={{ width: '100%' }}>
              {summaryItems.map((item, index) => (
                <React.Fragment key={index}>
                  <ListItem
                    sx={{
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      py: 1.5,
                      px: 0,
                      '&:hover': {
                        backgroundColor: 'action.hover',
                        borderRadius: 1
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                      <Box sx={{ flex: 1, minWidth: 0, mr: 2 }}>
                        <Typography 
                          variant="subtitle2" 
                          sx={{ 
                            fontWeight: 600,
                            mb: 0.5,
                            wordBreak: 'break-word'
                          }}
                        >
                          {item.label}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ 
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {formatFieldValue(item.value, { type: item.type, format: item.format })}
                        </Typography>
                      </Box>
                      {item.pageIndex >= 0 && (
                        <Link
                          component="button"
                          variant="body2"
                          onClick={() => handleFieldEdit(item)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            cursor: 'pointer',
                            textDecoration: 'none',
                            color: 'primary.main',
                            '&:hover': {
                              textDecoration: 'underline'
                            },
                            flexShrink: 0
                          }}
                        >
                          <EditIcon sx={{ fontSize: 16 }} />
                          Edit
                        </Link>
                      )}
                    </Box>
                  </ListItem>
                  {index < summaryItems.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Box>
      )}

      <Box sx={{ mt: 'auto', pt: 2 }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          fullWidth
          onClick={handleFinalize}
          disabled={Boolean(hasErrors)}
        >
          Finalize
        </Button>
      </Box>
    </Box>
  );
};

export const finalizeTester = (uischema: any) => uischema.type === 'Finalize' ? 3 : -1;

export const finalizeRenderer: JsonFormsRendererRegistryEntry = {
  tester: finalizeTester,
  renderer: withJsonFormsControlProps(FinalizeRenderer),
}; 