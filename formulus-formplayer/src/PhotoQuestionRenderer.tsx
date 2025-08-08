import React, { useState, useEffect, useRef, useCallback } from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { ControlProps, rankWith, schemaTypeIs, and, schemaMatches } from '@jsonforms/core';
import { 
  Button, 
  Box, 
  Typography, 
  Card, 
  CardMedia, 
  CardContent,
  IconButton,
  Alert
} from '@mui/material';
import { PhotoCamera, Delete, Refresh } from '@mui/icons-material';
import FormulusClient from './FormulusInterface';
import { AttachmentData } from './FormulusInterfaceDefinition';

// Tester function to identify photo question types
export const photoQuestionTester = rankWith(
  5, // High priority for photo questions
  and(
    schemaTypeIs('object'),
    schemaMatches((schema) => schema.format === 'photo')
  )
);

interface PhotoQuestionProps extends ControlProps {
  // Additional props specific to photo questions can be added here
}

const PhotoQuestionRenderer: React.FC<PhotoQuestionProps> = ({
  data,
  handleChange,
  path,
  errors,
  schema,
  uischema,
  enabled = true
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Safe error setter to prevent corruption
  const setSafeError = useCallback((errorMessage: string | null) => {
    console.log('setSafeError called with:', errorMessage, 'Type:', typeof errorMessage);
    console.log('Stack trace:', new Error().stack);
    if (errorMessage === null || errorMessage === undefined) {
      console.log('Clearing error state');
      setError(null);
    } else if (typeof errorMessage === 'string' && errorMessage.length > 0) {
      console.log('Setting valid error message:', errorMessage);
      setError(errorMessage);
    } else {
      console.warn('Invalid error message detected:', errorMessage, 'Type:', typeof errorMessage);
      console.log('Setting fallback error message');
      setError('An unknown error occurred');
    }
  }, []);
  const formulusClient = useRef<FormulusClient>(FormulusClient.getInstance());
  
  // Extract field ID from the path for use with the camera interface
  const fieldId = path.replace(/\//g, '_').replace(/^_/, '') || 'photo_field';
  
  // Get the current photo data from the form data (now JSON format)
  const currentPhotoData = data || null;
  const currentPhotoFilename = currentPhotoData?.filename || null;
  
  // Set photo URL from stored data if available
  useEffect(() => {
    if (currentPhotoData?.url) {
      setPhotoUrl(currentPhotoData.url);
    } else if (currentPhotoData?.base64) {
      setPhotoUrl(`data:image/jpeg;base64,${currentPhotoData.base64}`);
    } else {
      setPhotoUrl(null);
    }
  }, [currentPhotoData]);

  // Handle camera request with Promise-based approach
  const handleTakePhoto = useCallback(async () => {
    if (!enabled) return;
    
    setIsLoading(true);
    setSafeError(null);
    
    try {
      console.log('Requesting camera for field:', fieldId);
      
      // Create Promise that resolves when attachment is received or rejects on cancel/error
      const attachmentPromise = new Promise<AttachmentData>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Camera request timed out after 30 seconds'));
        }, 30000);
        
        const cleanup = () => {
          clearTimeout(timeout);
          // Clean up global callbacks
          delete (globalThis as any).onAttachmentReady;
          delete (globalThis as any).onCameraEvent;
        };
        
        const handleAttachmentReady = (attachmentData: AttachmentData) => {
          if (attachmentData.fieldId === fieldId && attachmentData.type === 'image') {
            cleanup();
            console.log('Received attachment for field:', fieldId, attachmentData);
            resolve(attachmentData);
          }
        };
        
        const handleCameraEvent = (event: { fieldId: string; eventType: 'cancel' | 'error'; message: string }) => {
          if (event.fieldId === fieldId) {
            cleanup();
            console.log('Received camera event for field:', fieldId, event);
            if (event.eventType === 'cancel') {
              reject(new Error('Camera operation was cancelled'));
            } else if (event.eventType === 'error') {
              reject(new Error(event.message || 'Camera error occurred'));
            }
          }
        };
        
        // Set up the global callbacks
        (globalThis as any).onAttachmentReady = handleAttachmentReady;
        (globalThis as any).onCameraEvent = handleCameraEvent;
      });
      
      // Request camera from the injected interface
      await formulusClient.current.requestCamera(fieldId);
      
      // Wait for the attachment data
      console.log('Waiting for attachment promise to resolve...');
      const attachment = await attachmentPromise;
      console.log('Attachment promise resolved with:', attachment);
      
      // Create rich photo data object
      const photoData = {
        type: attachment.type,
        filename: attachment.filename,
        url: attachment.url,
        base64: attachment.base64,
        timestamp: attachment.timestamp,
        metadata: attachment.metadata || {}
      };
      console.log('Created photo data object:', photoData);
      
      // Update the form data with the photo data
      console.log('Updating form data with photo data...');
      handleChange(path, photoData);
      
      // Set the photo URL for display
      const displayUrl = attachment.url || (attachment.base64 ? `data:image/jpeg;base64,${attachment.base64}` : null);
      if (displayUrl) {
        console.log('Setting photo URL for display:', displayUrl.substring(0, 50) + '...');
        setPhotoUrl(displayUrl);
      }
      
      // Explicitly clear any previous errors on successful photo capture
      console.log('Clearing error state after successful photo capture');
      setSafeError(null);
      
      console.log('Photo captured successfully:', photoData);
      
    } catch (err: any) {
      console.error('Error during camera request:', err);
      if (err.message && err.message.includes('cancelled')) {
        // Don't show error for cancellation, just reset loading state
        console.log('Camera operation cancelled by user');
        setSafeError(null); // Explicitly clear error on cancellation
      } else {
        const errorMessage = err?.message || err?.toString() || 'Failed to capture photo. Please try again.';
        console.log('Setting error message:', errorMessage);
        setSafeError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fieldId, enabled, handleChange, path, setSafeError]);


  // Handle photo deletion
  const handleDeletePhoto = useCallback(() => {
    if (!enabled) return;
    
    setPhotoUrl(null);
    handleChange(path, undefined);
    setSafeError(null);
    console.log('Photo deleted for field:', fieldId);
  }, [fieldId, handleChange, path, enabled, setSafeError]);

  // Get display label from schema or uischema
  const label = (uischema as any)?.label || schema.title || 'Photo';
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

      {/* Photo display or camera button */}
      {currentPhotoFilename && photoUrl ? (
        <Card sx={{ maxWidth: 400, mb: 2 }}>
          <CardMedia
            component="img"
            height="200"
            image={photoUrl}
            alt="Captured photo"
            sx={{ objectFit: 'cover' }}
          />
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                File: {currentPhotoFilename}
              </Typography>
              <Box>
                <IconButton 
                  onClick={handleTakePhoto} 
                  disabled={!enabled || isLoading}
                  color="primary"
                  title="Retake photo"
                >
                  <Refresh />
                </IconButton>
                <IconButton 
                  onClick={handleDeletePhoto} 
                  disabled={!enabled}
                  color="error"
                  title="Delete photo"
                >
                  <Delete />
                </IconButton>
              </Box>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ 
          border: '2px dashed #ccc', 
          borderRadius: 2, 
          p: 3, 
          textAlign: 'center',
          backgroundColor: '#fafafa'
        }}>
          <PhotoCamera sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {currentPhotoFilename ? 'Photo taken' : 'No photo taken yet'}
          </Typography>
          <Button
            variant="contained"
            startIcon={<PhotoCamera />}
            onClick={handleTakePhoto}
            disabled={!enabled || isLoading}
            size="large"
          >
            {isLoading ? 'Opening Camera...' : 'Take Photo'}
          </Button>
        </Box>
      )}

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <Box sx={{ mt: 2, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="caption" component="div">
            Debug Info:
          </Typography>
          <Typography variant="caption" component="pre" sx={{ fontSize: '0.7rem' }}>
            {JSON.stringify({
              fieldId,
              path,
              currentPhotoData,
              currentPhotoFilename,
              hasPhotoUrl: !!photoUrl,
              isLoading,
              error
            }, null, 2)}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default withJsonFormsControlProps(PhotoQuestionRenderer);
