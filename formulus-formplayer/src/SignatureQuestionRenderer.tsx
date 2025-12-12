import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Paper,
  IconButton
} from '@mui/material';
import { Draw as SignatureIcon, Delete as DeleteIcon, Clear as ClearIcon } from '@mui/icons-material';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { ControlProps, rankWith, formatIs } from '@jsonforms/core';
import FormulusClient from './FormulusInterface';
import { SignatureResult } from './FormulusInterfaceDefinition';

// Tester function - determines when this renderer should be used
export const signatureQuestionTester = rankWith(
  10, // Priority - higher than default string renderer
  formatIs('signature')
);

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
  // State management
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCanvas, setShowCanvas] = useState(false);
  
  // Refs
  const formulusClient = useRef(FormulusClient.getInstance());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  
  // Extract field ID from path
  const fieldId = path.split('.').pop() || path;
  
  // Handle signature capture via React Native
  const handleNativeSignature = useCallback(async () => {
    setIsCapturing(true);
    setError(null);
    
    try {
      const result: SignatureResult = await formulusClient.current.requestSignature(fieldId);
      
      if (result.status === 'success' && result.data) {
        // Update form data with the signature result
        handleChange(path, result.data);
        setShowCanvas(false);
      }
    } catch (err: any) {
      if (err.status === 'cancelled') {
        // User cancelled - don't show error
        console.log('Signature capture cancelled by user');
      } else if (err.status === 'error') {
        setError(err.message || 'Signature capture failed');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsCapturing(false);
    }
  }, [fieldId, handleChange, path]);

  // Handle canvas signature drawing
  const handleCanvasSignature = useCallback(() => {
    setShowCanvas(true);
    setError(null);
  }, []);

  // Canvas drawing functions
  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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
      y: (clientY - rect.top) * scaleY
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const point = getCanvasPoint(e);
    if (!point) return;
    
    isDrawingRef.current = true;
    lastPointRef.current = point;
  }, [getCanvasPoint]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawingRef.current || !canvasRef.current) return;
    
    const point = getCanvasPoint(e);
    if (!point || !lastPointRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    lastPointRef.current = point;
  }, [getCanvasPoint]);

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
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : ((r & 0x3) | 0x8);
        return v.toString(16);
      });
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
        strokeCount: 1 // Simplified for canvas implementation
      }
    };
    
    // Update form data
    handleChange(path, signatureData);
    setShowCanvas(false);
  }, [handleChange, path]);

  // Handle delete/clear
  const handleDelete = useCallback(() => {
    handleChange(path, null);
    setError(null);
  }, [handleChange, path]);

  // Initialize canvas
  useEffect(() => {
    if (showCanvas && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Set canvas size
        canvas.width = 400;
        canvas.height = 200;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [showCanvas]);

  // Don't render if not visible
  if (!visible) {
    return null;
  }
  
  const hasData = data && typeof data === 'object' && data.type === 'signature';
  const hasError = errors && (Array.isArray(errors) ? errors.length > 0 : errors.length > 0);
  
  return (
    <Box sx={{ mb: 2 }}>
      {/* Title and Description */}
      {schema.title && (
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
          {schema.title}
        </Typography>
      )}
      {schema.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {schema.description}
        </Typography>
      )}
      
      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* Validation Errors */}
      {hasError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {Array.isArray(errors) ? errors.join(', ') : errors}
        </Alert>
      )}
      
      {/* Canvas Signature Pad */}
      {showCanvas && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Draw your signature below:
          </Typography>
          <Box sx={{ 
            border: '2px dashed', 
            borderColor: 'divider',
            borderRadius: 1, 
            p: 1, 
            mb: 2,
            display: 'flex',
            justifyContent: 'center',
            backgroundColor: 'grey.50'
          }}>
            <canvas
              ref={canvasRef}
              style={{
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'crosshair',
                backgroundColor: 'white',
                touchAction: 'none'
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
              size="small"
            >
              Clear
            </Button>
            <Button
              variant="contained"
              onClick={saveCanvasSignature}
              disabled={!enabled}
              size="small"
            >
              Save Signature
            </Button>
            <Button
              variant="outlined"
              onClick={() => setShowCanvas(false)}
              disabled={!enabled}
              size="small"
            >
              Cancel
            </Button>
          </Box>
        </Paper>
      )}
      
      {/* Action Buttons */}
      {!showCanvas && (
        <Box sx={{ mb: 2 }}>
          <Button
            variant="contained"
            startIcon={isCapturing ? <CircularProgress size={20} /> : <SignatureIcon />}
            onClick={handleNativeSignature}
            disabled={!enabled || isCapturing}
            fullWidth
            sx={{ mb: 1 }}
          >
            {isCapturing ? 'Capturing Signature...' : 'Capture Signature (Native)'}
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<SignatureIcon />}
            onClick={handleCanvasSignature}
            disabled={!enabled}
            fullWidth
            size="small"
          >
            Draw Signature (Canvas)
          </Button>
        </Box>
      )}
      
      {/* Signature Display */}
      {hasData && (
        <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Signature Captured:
              </Typography>
              <Box sx={{ 
                border: '1px solid #ddd', 
                borderRadius: 1, 
                p: 1, 
                mb: 2,
                backgroundColor: 'white',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <img 
                  src={data.uri} 
                  alt="Signature" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '150px',
                    border: 'none'
                  }} 
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                File: {data.filename} | Size: {Math.round(data.metadata.size / 1024)}KB
              </Typography>
            </Box>
            <IconButton
              onClick={handleDelete}
              disabled={!enabled}
              size="small"
              sx={{ ml: 1 }}
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        </Paper>
      )}
      
      {/* Development Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <Box sx={{ mt: 2, p: 1, bgcolor: 'info.light', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
            Debug: fieldId="{fieldId}", path="{path}", format="signature"
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default withJsonFormsControlProps(SignatureQuestionRenderer);
