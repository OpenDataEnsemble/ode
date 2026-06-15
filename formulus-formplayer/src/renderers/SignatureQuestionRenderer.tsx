import React, { useCallback, useRef, useEffect } from 'react';
import { Button, Typography, Box, Paper, IconButton } from '@mui/material';
import {
  Draw as SignatureIcon,
  Delete as DeleteIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { ControlProps, rankWith, formatIs } from '@jsonforms/core';
import QuestionShell from '../components/QuestionShell';
import { tokens } from '../theme/tokens-adapter';

// Helper to parse pixel values from tokens
const parsePx = (value: string): number => {
  return parseInt(value.replace('px', ''), 10);
};

// Tester function - determines when this renderer should be used
export const signatureQuestionTester = rankWith(
  12, // Priority - above default string and object renderers so we always get the scope
  formatIs('signature'),
);

/**
 * Signature control: inline canvas for drawing, no Formulus API required.
 * Uses standard JSON Forms ControlProps: `data` is the current value (loaded when editing
 * a saved form), `handleChange(path, value)` persists changes. Signature data shape:
 * { type: 'signature', filename, uri, timestamp?, metadata? }.
 */
const SignatureQuestionRenderer: React.FC<ControlProps> = ({
  data,
  handleChange,
  path,
  errors,
  schema,
  uischema,
  enabled = true,
  visible = true,
}) => {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Extract field ID from path
  const fieldId = path.split('.').pop() || path;

  // Canvas drawing functions
  const getCanvasPoint = useCallback(
    (
      e:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>,
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      let clientX: number, clientY: number;

      if ('touches' in e) {
        if (e.touches.length === 0) return null;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const startDrawing = useCallback(
    (
      e:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>,
    ) => {
      e.preventDefault();
      const point = getCanvasPoint(e);
      if (!point) return;

      isDrawingRef.current = true;
      lastPointRef.current = point;
    },
    [getCanvasPoint],
  );

  const draw = useCallback(
    (
      e:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>,
    ) => {
      e.preventDefault();
      if (!isDrawingRef.current || !canvasRef.current) return;

      const point = getCanvasPoint(e);
      if (!point || !lastPointRef.current) return;

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = tokens.color.neutral.black;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      lastPointRef.current = point;
    },
    [getCanvasPoint],
  );

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  }, []);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Save canvas signature
  const saveCanvasSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1];

    // Generate GUID for signature
    const generateGUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        function (c) {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        },
      );
    };

    const signatureGuid = generateGUID();
    const filename = `${signatureGuid}.png`;

    // Create signature data object
    const signatureData = {
      type: 'signature' as const,
      filename,
      uri: dataUrl, // For canvas signatures, we still use data URL as URI
      timestamp: new Date().toISOString(),
      metadata: {
        width: canvas.width,
        height: canvas.height,
        size: Math.round(base64Data.length * 0.75), // Approximate size
        strokeCount: 1, // Simplified for canvas implementation
      },
    };

    // Update form data (UI switches to "signature captured" view)
    handleChange(path, signatureData);
  }, [handleChange, path]);

  // Clear signature and return to canvas
  const handleClearSignature = useCallback(() => {
    handleChange(path, null);
  }, [handleChange, path]);

  // Signature present when data has the expected shape
  const hasData =
    data &&
    typeof data === 'object' &&
    (data as { type?: string }).type === 'signature';

  // Initialize canvas when showing the pad (no signature yet)
  useEffect(() => {
    if (!hasData && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 560;
        canvas.height = 200;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const isDark =
          window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches;
        ctx.fillStyle = isDark
          ? tokens.color.neutral[900]
          : tokens.color.neutral.white;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [hasData]);

  // Don't render if not visible
  if (!visible) {
    return null;
  }

  const validationError =
    errors && (Array.isArray(errors) ? errors.join(', ') : errors);

  return (
    <QuestionShell block
      title={schema.title}
      description={schema.description}
      required={Boolean(
        (uischema as any)?.options?.required ??
        (schema as any)?.options?.required,
      )}
      error={validationError}
      helperText="Draw your signature in the box below, then save."
      metadata={
        process.env.NODE_ENV === 'development' ? (
          <Box
            sx={{
              mt: 1,
              p: 1,
              bgcolor: 'background.paper',
              borderRadius: parsePx(tokens.border.radius.md), // Match button border radius
              border: `${tokens.border.width.thin} solid`,
              borderColor: 'divider',
            }}>
            <Typography
              variant="caption"
              sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
              Debug: fieldId="{fieldId}", path="{path}", format="signature"
            </Typography>
          </Box>
        ) : undefined
      }>
      {/* Inline signature pad – shown when no signature has been captured yet */}
      {!hasData && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Draw your signature below:
          </Typography>
          <Box
            sx={{
              border: `${tokens.border.width.medium} dashed`,
              borderColor: 'divider',
              borderRadius: parsePx(tokens.border.radius.md),
              p: 1,
              mb: 2,
              display: 'flex',
              justifyContent: 'center',
              backgroundColor: 'background.paper',
            }}>
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                maxWidth: 560,
                aspectRatio: '560 / 200',
                border: `${tokens.border.width.thin} solid`,
                borderColor: 'divider',
                borderRadius: tokens.border.radius.md,
                cursor: 'crosshair',
                backgroundColor: 'background.paper',
                touchAction: 'none',
              }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={clearCanvas}
              disabled={!enabled}
              size="small">
              Clear
            </Button>
            <Button
              variant="contained"
              onClick={saveCanvasSignature}
              disabled={!enabled}
              size="small">
              Save Signature
            </Button>
          </Box>
        </Paper>
      )}

      {/* Signature captured – show image and options to replace or remove */}
      {hasData &&
        (() => {
          const sig = data as {
            uri: string;
            filename: string;
            metadata?: { size?: number };
          };
          return (
            <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ mb: 1 }}>
                    Signature captured
                  </Typography>
                  <Box
                    sx={{
                      border: `${tokens.border.width.thin} solid`,
                      borderColor: 'divider',
                      borderRadius: `${parsePx(tokens.border.radius.md)}px`,
                      p: 1,
                      mb: 2,
                      backgroundColor: 'background.paper',
                      display: 'flex',
                      justifyContent: 'center',
                    }}>
                    <img
                      src={sig.uri}
                      alt="Signature"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '150px',
                        border: 'none',
                      }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {sig.filename}
                    {sig.metadata?.size != null &&
                      ` · ${Math.round(sig.metadata.size / 1024)} KB`}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    gap: 0.5,
                    justifyContent: 'flex-end',
                    mt: 2,
                  }}>
                  <IconButton
                    onClick={handleClearSignature}
                    disabled={!enabled}
                    color="primary"
                    size="small"
                    aria-label="Replace signature">
                    <SignatureIcon />
                  </IconButton>
                  <IconButton
                    onClick={handleClearSignature}
                    disabled={!enabled}
                    color="error"
                    size="small"
                    aria-label="Remove signature">
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Box>
            </Paper>
          );
        })()}
    </QuestionShell>
  );
};

export default withJsonFormsControlProps(SignatureQuestionRenderer);
