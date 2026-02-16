import React, { useState, useCallback, useRef } from 'react';
import {
  Typography,
  Box,
  CircularProgress,
  IconButton,
  TextField,
  Button,
  Paper,
  Chip,
} from '@mui/material';
import {
  QrCodeScanner as QrCodeIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { ControlProps, rankWith, formatIs } from '@jsonforms/core';
import FormulusClient from '../services/FormulusInterface';
import { QrcodeResult } from '../types/FormulusInterfaceDefinition';
import QuestionShell from '../components/QuestionShell';

/**
 * Tester function — matches any schema field with "format": "qrcode".
 * Priority 10 ensures this takes precedence over default string renderers.
 *
 * Schema usage:
 *   { "type": "string", "format": "qrcode", "title": "Scan QR code" }
 *
 * The scanned value is stored as a plain string in the form data.
 */
export const qrcodeQuestionTester = rankWith(
  10, // Same priority as signature renderer
  formatIs('qrcode'),
);

const QrcodeQuestionRenderer: React.FC<ControlProps> = ({
  data,
  handleChange,
  path,
  errors,
  schema,
  uischema,
  enabled = true,
  visible = true,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualValue, setManualValue] = useState('');

  const formulusClient = useRef(FormulusClient.getInstance());

  // Extract field ID from path
  const fieldId = path.replace(/\//g, '_').replace(/^_/, '') || 'qrcode_field';

  // The stored data is a plain string (the QR code value)
  const currentValue: string | null =
    data && typeof data === 'string' ? data : null;

  // Handle QR code scan via Formulus native bridge
  const handleScan = useCallback(async () => {
    if (!enabled) return;

    setIsScanning(true);
    setError(null);

    try {
      console.log('Requesting QR code scanner for field:', fieldId);
      const result: QrcodeResult =
        await formulusClient.current.requestQrcode(fieldId);

      console.log('QR code result received:', result);

      if (result.status === 'success' && result.data) {
        // Store the scanned value as a plain string
        handleChange(path, result.data.value);
        setShowManualEntry(false);
        setManualValue('');
        setError(null);
        console.log('QR code scanned successfully:', result.data.value);
      } else {
        const errorMessage =
          result.message || `QR scanner operation ${result.status}`;
        throw new Error(errorMessage);
      }
    } catch (err: any) {
      console.error('Error during QR code scan:', err);

      if (err && typeof err === 'object' && 'status' in err) {
        const qrError = err as QrcodeResult;
        if (qrError.status === 'cancelled') {
          // User cancelled — don't show error
          console.log('QR scan cancelled by user');
        } else if (qrError.status === 'error') {
          setError(qrError.message || 'QR scanner error');
        } else {
          setError('Unknown QR scanner error');
        }
      } else {
        setError(err?.message || 'Failed to scan QR code. Try manual entry.');
      }
    } finally {
      setIsScanning(false);
    }
  }, [fieldId, enabled, handleChange, path]);

  // Handle manual entry submission
  const handleManualSubmit = useCallback(() => {
    if (!manualValue.trim()) return;
    handleChange(path, manualValue.trim());
    setShowManualEntry(false);
    setManualValue('');
    setError(null);
  }, [manualValue, handleChange, path]);

  // Handle delete/clear
  const handleDelete = useCallback(() => {
    handleChange(path, undefined);
    setError(null);
    setManualValue('');
    console.log('QR code value cleared for field:', fieldId);
  }, [fieldId, handleChange, path]);

  // Don't render if not visible
  if (!visible) {
    return null;
  }

  const label = (uischema as any)?.label || schema.title || 'QR Code';
  const description = schema.description;
  const isRequired = Boolean(
    (uischema as any)?.options?.required ??
    (schema as any)?.options?.required ??
    false,
  );

  const validationError = errors && errors.length > 0 ? String(errors) : null;

  return (
    <QuestionShell
      title={label}
      description={description}
      required={isRequired}
      error={error || validationError}
      metadata={
        process.env.NODE_ENV === 'development' ? (
          <Box
            sx={{
              p: 1,
              bgcolor: 'background.paper',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            }}>
            <Typography
              variant="caption"
              sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
              Debug: fieldId="{fieldId}", path="{path}", format="qrcode",
              value="{currentValue || 'empty'}"
            </Typography>
          </Box>
        ) : undefined
      }>
      {/* State: Value already scanned/entered */}
      {currentValue ? (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            border: '1px solid',
            borderColor: 'success.light',
            borderRadius: 2,
            bgcolor: 'success.light',
            // Use a subtle green tint
            background: theme =>
              theme.palette.mode === 'dark'
                ? 'rgba(46, 125, 50, 0.08)'
                : 'rgba(46, 125, 50, 0.04)',
          }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Chip
                icon={<QrCodeIcon />}
                label={currentValue}
                color="success"
                variant="outlined"
                sx={{
                  maxWidth: '100%',
                  height: 'auto',
                  '& .MuiChip-label': {
                    whiteSpace: 'normal',
                    wordBreak: 'break-all',
                    py: 0.5,
                    fontSize: '0.95rem',
                    fontFamily: 'monospace',
                  },
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
              <IconButton
                onClick={handleScan}
                disabled={!enabled || isScanning}
                color="primary"
                size="small"
                aria-label="Rescan QR code">
                <RefreshIcon />
              </IconButton>
              <IconButton
                onClick={handleDelete}
                disabled={!enabled}
                color="error"
                size="small"
                aria-label="Clear QR code value">
                <DeleteIcon />
              </IconButton>
            </Box>
          </Box>
        </Paper>
      ) : (
        <>
          {/* State: No value — show scan button */}
          {!showManualEntry && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: { xs: 4, sm: 5 },
                px: 2,
              }}>
              <IconButton
                onClick={handleScan}
                disabled={!enabled || isScanning}
                color="primary"
                size="large"
                sx={{
                  width: { xs: 64, sm: 72 },
                  height: { xs: 64, sm: 72 },
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  '&:disabled': {
                    backgroundColor: 'action.disabledBackground',
                    color: 'action.disabled',
                  },
                }}
                aria-label="Scan QR code">
                {isScanning ? (
                  <CircularProgress size={28} sx={{ color: 'white' }} />
                ) : (
                  <QrCodeIcon sx={{ fontSize: { xs: 32, sm: 36 } }} />
                )}
              </IconButton>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 2, textAlign: 'center' }}>
                {isScanning ? 'Opening scanner...' : 'Tap to scan QR code'}
              </Typography>

              {/* Manual entry link */}
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => setShowManualEntry(true)}
                disabled={!enabled}
                sx={{ mt: 2, textTransform: 'none' }}>
                Enter code manually
              </Button>
            </Box>
          )}

          {/* State: Manual entry mode */}
          {showManualEntry && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <TextField
                value={manualValue}
                onChange={e => setManualValue(e.target.value)}
                placeholder="Enter QR code value..."
                variant="outlined"
                size="small"
                fullWidth
                disabled={!enabled}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleManualSubmit();
                  }
                }}
                InputProps={{
                  sx: { fontFamily: 'monospace' },
                }}
              />
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<CloseIcon />}
                  onClick={() => {
                    setShowManualEntry(false);
                    setManualValue('');
                  }}
                  disabled={!enabled}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<CheckIcon />}
                  onClick={handleManualSubmit}
                  disabled={!enabled || !manualValue.trim()}>
                  Confirm
                </Button>
              </Box>

              {/* Still allow scanning from manual entry mode */}
              <Button
                size="small"
                startIcon={<QrCodeIcon />}
                onClick={handleScan}
                disabled={!enabled || isScanning}
                sx={{ textTransform: 'none', alignSelf: 'center' }}>
                {isScanning ? 'Opening scanner...' : 'Use scanner instead'}
              </Button>
            </Box>
          )}
        </>
      )}
    </QuestionShell>
  );
};

export default withJsonFormsControlProps(QrcodeQuestionRenderer);
