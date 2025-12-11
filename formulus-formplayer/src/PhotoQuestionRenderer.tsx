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
import {
  CameraResult
} from './FormulusInterfaceDefinition';

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
  
  // Extract field ID from the path for use with the camera interface
  const fieldId = path.replace(/\//g, '_').replace(/^_/, '') || 'photo_field';
  
  // Get the current photo data from the form data (now JSON format)
  const currentPhotoData = data || null;
  
  // Set photo URL from stored data if available
  useEffect(() => {
    console.log('Photo data changed:', currentPhotoData);
    if (currentPhotoData?.uri) {
      // For WebView, we need to handle file:// URLs differently
      // In development/mock mode, file URLs might work, but in production we need a different approach
      console.log('Setting photo URL from stored data:', currentPhotoData.uri);
      setPhotoUrl(currentPhotoData.uri);
    } else {
      console.log('No photo URI found, clearing photoUrl state');
      setPhotoUrl(null);
    }
  }, [currentPhotoData]);

  // Handle camera request with new Promise-based approach
  const handleTakePhoto = useCallback(async () => {
    if (!enabled) return;
    
    setIsLoading(true);
    setSafeError(null);
    
    try {
      console.log('Requesting camera for field:', fieldId);
      
      // Use the new Promise-based camera API
      const cameraResult: CameraResult = await formulusClient.current.requestCamera(fieldId);
      
      console.log('Camera result received:', cameraResult);
      
      // Check if the result was successful
      if (cameraResult.status === 'success' && cameraResult.data) {
        // Store photo data in form - use file URI for display
        const displayUri = cameraResult.data.uri;
        
        const photoData = {
          id: cameraResult.data.id,
          type: cameraResult.data.type,
          filename: cameraResult.data.filename,
          uri: cameraResult.data.uri,
          timestamp: cameraResult.data.timestamp,
          metadata: cameraResult.data.metadata
        };
        console.log('Created photo data object for sync protocol:', {
          id: photoData.id,
          filename: photoData.filename,
          uri: photoData.uri,
          persistentStorage: photoData.metadata.persistentStorage,
          size: photoData.metadata.size
        });
        
        // Update the form data with the photo data
        console.log('Updating form data with photo data...');
        handleChange(path, photoData);
        
        // Set the photo URL for display using the file URI
        console.log('Setting photo URL for display:', displayUri.substring(0, 50) + '...');
        setPhotoUrl(displayUri);
        
        // Clear any previous errors on successful photo capture
        console.log('Clearing error state after successful photo capture');
        setSafeError(null);
        
        console.log('Photo captured successfully:', photoData);
      } else {
        // Handle non-success results
        const errorMessage = cameraResult.message || `Camera operation ${cameraResult.status}`;
        throw new Error(errorMessage);
      }
      
    } catch (err: any) {
      console.error('Error during camera request:', err);
      
      // Handle different types of camera errors
      if (err && typeof err === 'object' && 'status' in err) {
        const cameraError = err as CameraResult;
        if (cameraError.status === 'cancelled') {
          // Don't show error for cancellation, just reset loading state
          console.log('Camera operation cancelled by user');
          setSafeError(null);
        } else if (cameraError.status === 'error') {
          const errorMessage = cameraError.message || 'Camera error occurred';
          console.log('Setting camera error message:', errorMessage);
          setSafeError(errorMessage);
        } else {
          setSafeError('Unknown camera error');
        }
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
      {currentPhotoData && currentPhotoData.filename && photoUrl ? (
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
                File: {currentPhotoData.filename}
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
          border: '2px dashed', 
          borderColor: 'divider',
          borderRadius: 2, 
          p: 3, 
          textAlign: 'center',
          backgroundColor: 'grey.50'
        }}>
          <PhotoCamera sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {currentPhotoData?.filename ? 'Photo taken' : 'No photo taken yet'}
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
              hasPhotoData: !!currentPhotoData,
              hasFilename: !!currentPhotoData?.filename,
              hasUri: !!currentPhotoData?.uri,
              photoUrl,
              hasPhotoUrl: !!photoUrl,
              shouldShowThumbnail: !!(currentPhotoData && currentPhotoData.filename && photoUrl),
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
