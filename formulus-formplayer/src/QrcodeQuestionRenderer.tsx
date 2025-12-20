import React, { useState, useRef, useCallback } from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { ControlProps, rankWith, schemaTypeIs, and, schemaMatches } from '@jsonforms/core';
import {
  Button,
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Alert,
  TextField,
} from '@mui/material';
import { QrCodeScanner, Delete, Refresh } from '@mui/icons-material';
import FormulusClient from './FormulusInterface';
import { QrcodeResult } from './FormulusInterfaceDefinition';

// Tester function to identify QR code question types
export const qrcodeQuestionTester = rankWith(
  5, // High priority for QR code questions
  and(
    schemaTypeIs('string'),
    schemaMatches((schema) => schema.format === 'qrcode'),
  ),
);

interface QrcodeQuestionProps extends ControlProps {
  // Additional props specific to QR code questions can be added here
}

const QrcodeQuestionRenderer: React.FC<QrcodeQuestionProps> = ({
  data,
  handleChange,
  path,
  errors,
  schema,
  uischema,
  enabled = true,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Safe error setter to prevent corruption
  const setSafeError = useCallback((errorMessage: string | null) => {
    if (errorMessage === null || errorMessage === undefined) {
      setError(null);
    } else if (typeof errorMessage === 'string' && errorMessage.length > 0) {
      setError(errorMessage);
    } else {
      console.warn('Invalid error message detected:', errorMessage, 'Type:', typeof errorMessage);
      setError('An unknown error occurred');
    }
  }, []);

  const formulusClient = useRef<FormulusClient>(FormulusClient.getInstance());

  // Extract field ID from the path for use with the QR code interface
  const fieldId = path.replace(/\//g, '_').replace(/^_/, '') || 'qrcode_field';

  // Get the current QR code value from the form data
  const currentQrcodeValue = data || '';

  // Handle QR code scan request with new Promise-based approach
  const handleScanQrcode = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setSafeError(null);

    try {
      console.log('Requesting QR code scanner for field:', fieldId);

      // Use the new Promise-based QR code API
      const qrcodeResult: QrcodeResult = await formulusClient.current.requestQrcode(fieldId);

      console.log('QR code result received:', qrcodeResult);

      // Check if the result was successful
      if (qrcodeResult.status === 'success' && qrcodeResult.data) {
        // Store QR code value in form
        const qrcodeValue = qrcodeResult.data.value;

        console.log('QR code scanned successfully:', qrcodeValue);

        // Update the form data with the QR code value
        console.log('Updating form data with QR code value...');
        handleChange(path, qrcodeValue);

        // Clear any previous errors on successful QR code scan
        console.log('Clearing error state after successful QR code scan');
        setSafeError(null);

        console.log('QR code captured successfully:', qrcodeValue);
      } else {
        // Handle non-success results
        const errorMessage = qrcodeResult.message || `QR code scanning ${qrcodeResult.status}`;
        throw new Error(errorMessage);
      }
    } catch (err: any) {
      console.error('Error during QR code scan request:', err);

      // Handle different types of QR code scanning errors
      if (err && typeof err === 'object' && 'status' in err) {
        const qrcodeError = err as QrcodeResult;
        if (qrcodeError.status === 'cancelled') {
          // Don't show error for cancellation, just reset loading state
          console.log('QR code scanning cancelled by user');
          setSafeError(null);
        } else if (qrcodeError.status === 'error') {
          const errorMessage = qrcodeError.message || 'QR code scanner error occurred';
          console.log('Setting QR code scanner error message:', errorMessage);
          setSafeError(errorMessage);
        } else {
          setSafeError('Unknown QR code scanner error');
        }
      } else {
        const errorMessage =
          err?.message || err?.toString() || 'Failed to scan QR code. Please try again.';
        console.log('Setting error message:', errorMessage);
        setSafeError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fieldId, enabled, handleChange, path, setSafeError]);

  // Handle QR code value deletion
  const handleDeleteQrcode = useCallback(() => {
    if (!enabled) return;

    handleChange(path, '');
    setSafeError(null);
    console.log('QR code value deleted for field:', fieldId);
  }, [fieldId, handleChange, path, enabled, setSafeError]);

  // Handle manual text input change
  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!enabled) return;

      const newValue = event.target.value;
      handleChange(path, newValue);
      setSafeError(null);
      console.log('QR code value manually changed for field:', fieldId, 'to:', newValue);
    },
    [fieldId, handleChange, path, enabled, setSafeError],
  );

  // Get display label from schema or uischema
  const label = (uischema as any)?.label || schema.title || 'QR Code';
  const description = schema.description;
  const isRequired = schema.required || false;

  return (
    <Box sx={{ mb: 2, width: '100%' }}>
      {/* Label and description */}
      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'medium' }}>
        {label}
        {isRequired && <span style={{ color: 'red' }}> *</span>}
      </Typography>

      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
      )}

      {/* Error display - full width, pushes content down */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, width: '100%', display: 'block' }}>
          {error}
        </Alert>
      )}

      {/* Form validation errors */}
      {errors && errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2, width: '100%' }}>
          {String(errors[0])}
        </Alert>
      )}

      {/* QR code value display or scanner button */}
      {currentQrcodeValue ? (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Scanned QR Code Value:
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={6}
                value={currentQrcodeValue}
                onChange={handleTextChange}
                disabled={!enabled}
                variant="outlined"
                placeholder="QR code value will appear here..."
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <IconButton
                  onClick={handleScanQrcode}
                  disabled={!enabled || isLoading}
                  color="primary"
                  title="Scan again"
                >
                  <Refresh />
                </IconButton>
                <IconButton
                  onClick={handleDeleteQrcode}
                  disabled={!enabled}
                  color="error"
                  title="Clear QR code value"
                >
                  <Delete />
                </IconButton>
              </Box>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Box
          sx={{
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            backgroundColor: 'grey.50',
          }}
        >
          <QrCodeScanner sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            No QR code scanned yet
          </Typography>
          <Button
            variant="contained"
            startIcon={<QrCodeScanner />}
            onClick={handleScanQrcode}
            disabled={!enabled || isLoading}
            size="large"
          >
            {isLoading ? 'Opening Scanner...' : 'Scan QR Code'}
          </Button>

          {/* Manual input option */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Or enter manually:
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              value={currentQrcodeValue}
              onChange={handleTextChange}
              disabled={!enabled}
              variant="outlined"
              placeholder="Enter QR code value manually..."
            />
          </Box>
        </Box>
      )}

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <Box sx={{ mt: 2, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="caption" component="div">
            Debug Info:
          </Typography>
          <Typography variant="caption" component="pre" sx={{ fontSize: '0.7rem' }}>
            {JSON.stringify(
              {
                fieldId,
                path,
                currentQrcodeValue,
                hasQrcodeValue: !!currentQrcodeValue,
                isLoading,
                error,
              },
              null,
              2,
            )}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default withJsonFormsControlProps(QrcodeQuestionRenderer);
