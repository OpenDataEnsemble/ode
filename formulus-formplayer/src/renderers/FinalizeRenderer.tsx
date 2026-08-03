import React, { useContext, useMemo, useCallback } from 'react';
import { Box, List, ListItem, Typography, IconButton } from '@mui/material';
import { tokens } from '../theme/tokens-adapter';
import { Button } from '@ode/components/react-web';
import { JsonFormsRendererRegistryEntry } from '@jsonforms/core';
import { withJsonFormsControlProps, useJsonForms } from '@jsonforms/react';
import { ControlProps } from '@jsonforms/core';
import { ErrorObject } from 'ajv';
import { useFormContext } from '../App';
import EditIcon from '@mui/icons-material/Edit';
import { displayAdate } from '../utils/adateUtils';
import { formatDurationHuman } from '../components/duration/durationFormat';
import { useOdeT } from '../i18n/useOdeT';
import { translateAjvError } from '../i18n/createOdeI18n';
import { FormplayerLocaleContext } from '../i18n/FormplayerLocaleContext';
import { titleForAjvError } from '../utils/errorPageNavigation';
import { instancePathForAjvError } from '../utils/validationNavigation';
import { resolveFieldLabel } from '../utils/controlDisplayText';
import type { JsonSchema7 } from '@jsonforms/core';

interface SummaryItem {
  label: string;
  value: any;
  path: string;
  pageIndex: number;
  type?: string;
  format?: string;
}

const FinalizeRenderer = ({ data }: ControlProps) => {
  const { core } = useJsonForms();
  const t = useOdeT();
  const locale = useContext(FormplayerLocaleContext);
  const errors = core?.errors || [];
  const { formInitData } = useFormContext();
  const fullSchema = core?.schema;
  const localizedUiSchema = core?.uischema;
  const fullUISchema = localizedUiSchema ?? formInitData?.uiSchema;

  const getFieldLabel = useCallback(
    (fullPath: string, fieldSchema: any): string => {
      const normalized = fullPath.replace(/^#\/properties\//, '');
      const segments = normalized.split('/').filter(Boolean);
      const key = segments[segments.length - 1] || normalized;
      if (segments.length === 1 && key) {
        return resolveFieldLabel(
          fullSchema as JsonSchema7 | undefined,
          localizedUiSchema,
          key,
        );
      }
      return fieldSchema?.title || fieldSchema?.description || key || fullPath;
    },
    [fullSchema, localizedUiSchema],
  );

  // Helper function to format field value based on type
  const formatFieldValue = (value: any, fieldSchema: any): string => {
    if (value === null || value === undefined || value === '') {
      return t('finalize.notProvided', 'Not provided');
    }

    // Handle special formats
    if (fieldSchema?.format) {
      switch (fieldSchema.format) {
        case 'photo':
          if (typeof value === 'object' && value.uri) {
            return t('finalize.value.photoWithName', 'Photo: {{name}}', {
              name: value.filename || t('finalize.value.captured', 'Captured'),
            });
          }
          return t('finalize.value.photoCaptured', 'Photo captured');
        case 'qrcode':
          if (typeof value === 'object' && value.data) {
            return t('finalize.value.qrWithData', 'QR Code: {{data}}', {
              data: String(value.data),
            });
          }
          return typeof value === 'string'
            ? t('finalize.value.qrWithData', 'QR Code: {{data}}', {
                data: value,
              })
            : t('finalize.value.qrScanned', 'QR Code scanned');
        case 'signature':
          if (typeof value === 'object' && value.uri) {
            return t('finalize.value.signatureCaptured', 'Signature captured');
          }
          return t('finalize.value.signatureProvided', 'Signature provided');
        case 'select_file':
          if (typeof value === 'object' && value.filename) {
            const original =
              typeof value.metadata?.originalFileName === 'string'
                ? value.metadata.originalFileName.trim()
                : '';
            const label =
              original.length > 0 ? original : String(value.filename);
            return t('finalize.value.fileWithName', 'File: {{name}}', {
              name: label,
            });
          }
          return t('finalize.value.fileSelected', 'File selected');
        case 'audio':
          if (typeof value === 'object' && value.filename) {
            const duration = value.metadata?.duration
              ? ` (${Math.round(value.metadata.duration)}s)`
              : '';
            return t(
              'finalize.value.audioWithName',
              'Audio: {{name}}{{duration}}',
              {
                name: String(value.filename),
                duration,
              },
            );
          }
          return t('finalize.value.audioRecorded', 'Audio recorded');
        case 'gps':
          if (typeof value === 'object' && value.latitude && value.longitude) {
            return t('finalize.value.location', 'Location: {{coords}}', {
              coords: `${value.latitude.toFixed(6)}, ${value.longitude.toFixed(6)}`,
            });
          }
          return t('finalize.value.gpsCaptured', 'GPS location captured');
        case 'video':
          if (typeof value === 'object' && value.filename) {
            return t('finalize.value.videoWithName', 'Video: {{name}}', {
              name: String(value.filename),
            });
          }
          return t('finalize.value.videoCaptured', 'Video captured');
        case 'date':
          return new Date(value).toLocaleDateString();
        case 'date-time':
          return new Date(value).toLocaleString();
        case 'time':
          return value;
        case 'adate':
          return displayAdate(value);
        case 'likert': {
          if (value === null)
            return t('finalize.value.notApplicable', 'Not applicable');
          const oneOf = fieldSchema?.oneOf;
          if (Array.isArray(oneOf)) {
            const match = oneOf.find(
              (o: { const?: unknown; title?: string }) => o.const === value,
            );
            if (match?.title) return match.title;
          }
          return String(value);
        }
        case 'duration':
          if (typeof value === 'number' && !Number.isNaN(value)) {
            return formatDurationHuman(value);
          }
          return t('finalize.notProvided', 'Not provided');
      }
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) return t('finalize.none', 'None');
      return value
        .map((item, idx) => {
          if (typeof item === 'object') {
            return `${idx + 1}. ${JSON.stringify(item)}`;
          }
          return String(item);
        })
        .join(', ');
    }

    // Handle objects
    if (typeof value === 'object') {
      // Check if it's a nested object with properties
      if (Object.keys(value).length === 0) return t('finalize.empty', 'Empty');
      return JSON.stringify(value, null, 2);
    }

    // Handle booleans
    if (typeof value === 'boolean') {
      return value ? t('finalize.yes', 'Yes') : t('finalize.no', 'No');
    }

    // Default: convert to string
    return String(value);
  };

  // Helper function to find which page/screen a field is on
  const findFieldPageMemo = useMemo(() => {
    return (fieldPath: string): number => {
      if (!fullUISchema || !(fullUISchema as any).elements) return -1;

      // Normalize the field path (remove #/properties/ prefix and convert / to .)
      const normalizePath = (path: string) => {
        return path.replace(/^#\/properties\//, '').replace(/\//g, '.');
      };

      const fieldName = normalizePath(fieldPath);
      const screens = (fullUISchema as any).elements;

      for (let i = 0; i < screens.length; i++) {
        const screen = screens[i];
        if (screen.type === 'Finalize') continue;

        if ('elements' in screen && (screen as any).elements) {
          const hasField = screen.elements.some((el: any) => {
            if (el.scope) {
              const scopePath = normalizePath(el.scope);
              // Exact match or field is nested under scope, or scope is nested under field
              return (
                scopePath === fieldName ||
                fieldName.startsWith(scopePath + '.') ||
                scopePath.startsWith(fieldName + '.')
              );
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

    const extractFields = (
      schemaObj: any,
      dataObj: any,
      basePath: string = '',
    ) => {
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
          (typeof fieldValue === 'object' &&
            !Array.isArray(fieldValue) &&
            Object.keys(fieldValue).length === 0);

        if (isEmpty) {
          // Only include empty fields if they are required (to show what's missing)
          const isRequired = schemaObj.required?.includes(key);
          if (!isRequired) return;
        }

        // Handle nested objects
        if (
          fieldSchema.type === 'object' &&
          fieldSchema.properties &&
          typeof fieldValue === 'object' &&
          !Array.isArray(fieldValue)
        ) {
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
            format: fieldSchema.format,
          });
        }
      });
    };

    extractFields(fullSchema, data);

    return items;
  }, [fullSchema, data, findFieldPageMemo, getFieldLabel]);

  const formatErrorMessage = (error: ErrorObject) => {
    const title = titleForAjvError(
      error,
      fullSchema as JsonSchema7 | undefined,
      localizedUiSchema,
    );
    const translated = translateAjvError(locale, error);
    return title ? `${title}: ${translated}` : translated;
  };

  const hasErrors = Array.isArray(errors) && errors.length > 0;

  const navigateToPath = (path: string) => {
    if (!path) return;
    window.dispatchEvent(
      new CustomEvent('navigateToError', {
        detail: { path },
      }),
    );
  };

  const handleErrorClick = (error: ErrorObject) => {
    const path = instancePathForAjvError(error);
    if (path) navigateToPath(path);
  };

  const handleFieldEdit = (item: SummaryItem) => {
    if (item.pageIndex >= 0) {
      // Navigate to the page containing this field
      const navigateEvent = new CustomEvent('navigateToPage', {
        detail: { page: item.pageIndex },
      });
      window.dispatchEvent(navigateEvent);
    } else {
      // Fallback: try to navigate using the field path
      navigateToPath(item.path);
    }
  };

  const handleFinalize = () => {
    if (!formInitData) {
      console.error(
        'formInitData is not available from context, cannot submit form',
      );
      return;
    }
    if (!hasErrors) {
      console.log('Dispatching finalizeForm event to submit data via App.tsx');
      const event = new CustomEvent('finalizeForm', {
        detail: { formInitData, data },
      });
      window.dispatchEvent(event);
    }
  };

  return (
    <Box
      sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {hasErrors ? (
        <>
          <Typography
            variant="h5"
            color="error"
            gutterBottom
            sx={{ textAlign: 'center' }}>
            {t(
              'finalize.fixErrors',
              'Please fix the following errors before finalizing:',
            )}
          </Typography>
          <Box
            sx={{
              mb: 3,
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              alignItems: 'center',
            }}>
            {errors.map((error: ErrorObject, index: number) => (
              <Button
                key={index}
                variant="danger"
                size="medium"
                onPress={() => handleErrorClick(error)}
                style={{
                  width: '100%',
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  textAlign: 'center',
                }}>
                {formatErrorMessage(error)}
              </Button>
            ))}
          </Box>
        </>
      ) : (
        <Typography
          variant="subtitle1"
          color="success.main"
          gutterBottom
          sx={{ textAlign: 'center' }}>
          {t(
            'finalize.allValid',
            'All validations passed! You can now finalize your submission.',
          )}
        </Typography>
      )}

      <Box sx={{ mt: 'auto', pt: 2 }}>
        <Button
          variant="primary"
          size="medium"
          onPress={handleFinalize}
          disabled={Boolean(hasErrors)}
          className="formplayer-solid-primary"
          style={{ width: '100%' }}>
          {t('nav.finalize', 'Finalize')}
        </Button>
      </Box>

      {/* Summary Section */}
      {summaryItems.length > 0 && (
        <Box
          sx={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            mb: 3,
            backgroundColor: 'transparent',
          }}>
          <Typography
            variant="h5"
            gutterBottom
            sx={{ fontWeight: 700, textAlign: 'center' }}>
            {t('finalize.summary', 'FORM SUMMARY')}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            gutterBottom
            sx={{ mb: 2, textAlign: 'center' }}>
            {t(
              'finalize.reviewHint',
              'Review all your entered data below. Click on any field to edit it.',
            )}
          </Typography>
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              p: 2,
              maxHeight: '100%',
              backgroundColor: 'transparent',
            }}>
            <List
              sx={{
                width: '100%',
                backgroundColor: 'transparent',
                '&.MuiList-root': {
                  backgroundColor: 'transparent',
                },
                '& .MuiListItem-root': {
                  backgroundColor: 'transparent',
                  borderRadius: 0,
                },
              }}>
              {summaryItems.map((item, index) => (
                <React.Fragment key={index}>
                  <ListItem
                    sx={theme => {
                      const lineColor =
                        theme.palette.mode === 'dark'
                          ? theme.palette.divider
                          : ((
                              theme.palette.grey as unknown as Record<
                                number,
                                string
                              >
                            )?.[300] ?? theme.palette.divider);
                      return {
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        py: 1.5,
                        px: 2,
                        backgroundColor: 'transparent',
                        borderLeft: `${(tokens as any).border?.width?.thin ?? '1px'} solid ${lineColor}`,
                        '&:hover': {
                          backgroundColor: 'action.hover',
                          borderRadius: 0,
                        },
                      };
                    }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        width: '100%',
                      }}>
                      <Box sx={{ flex: 1, minWidth: 0, mr: 2 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 600,
                            mb: 0.5,
                            wordBreak: 'break-word',
                          }}>
                          {item.label}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                          }}>
                          {formatFieldValue(item.value, {
                            type: item.type,
                            format: item.format,
                          })}
                        </Typography>
                      </Box>
                      {item.pageIndex >= 0 && (
                        <IconButton
                          onClick={() => handleFieldEdit(item)}
                          size="small"
                          sx={{
                            padding: (tokens as any).spacing?.[1] ?? '4px',
                            color: 'text.secondary',
                            '&:hover': {
                              color: 'primary.main',
                              backgroundColor: 'transparent',
                            },
                            flexShrink: 0,
                          }}
                          aria-label={t('finalize.editField', 'Edit field')}>
                          <EditIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      )}
                    </Box>
                  </ListItem>
                  {index < summaryItems.length - 1 && (
                    <Box
                      sx={theme => {
                        const lineColor =
                          theme.palette.mode === 'dark'
                            ? theme.palette.divider
                            : ((
                                theme.palette.grey as unknown as Record<
                                  number,
                                  string
                                >
                              )?.[300] ?? theme.palette.divider);
                        return {
                          height: (tokens as any).border?.width?.thin ?? '1px',
                          width: '100%',
                          background: `linear-gradient(to right, ${lineColor}, ${lineColor} 75%, transparent 100%)`,
                        };
                      }}
                    />
                  )}
                </React.Fragment>
              ))}
            </List>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export const finalizeTester = (uischema: any) =>
  uischema.type === 'Finalize' ? 3 : -1;

export const finalizeRenderer: JsonFormsRendererRegistryEntry = {
  tester: finalizeTester,
  renderer: withJsonFormsControlProps(FinalizeRenderer),
};
