import React, { useState, useEffect, useRef, useCallback } from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import {
  ControlProps,
  rankWith,
  schemaTypeIs,
  and,
  schemaMatches,
} from '@jsonforms/core';
import {
  Box,
  Typography,
  Card,
  CardMedia,
  CardContent,
  IconButton,
} from '@mui/material';
import { PhotoCamera, Delete, Refresh } from '@mui/icons-material';
import FormulusClient from '../services/FormulusInterface';
import {
  CameraResult,
  CameraResultData,
} from '../types/FormulusInterfaceDefinition';
import QuestionShell from '../components/QuestionShell';
import { tokens } from '../theme/tokens-adapter';
import { useClearOnHide } from '../jsonforms/useClearOnHide';
import {
  attachmentBasenameFromFilename,
  attachmentBasenameFromObservation,
} from '../utils/attachmentBasename';
import { formatControlErrors } from '../utils/formatControlErrors';
import {
  resolveControlDescription,
  resolveControlLabel,
} from '../utils/controlDisplayText';
import { useOdeT } from '../i18n/useOdeT';

// Helper to parse pixel values from tokens
const parsePx = (value: string): number => {
  return parseInt(value.replace('px', ''), 10);
};

/**
 * Subset of camera metadata kept on the observation (portable, no host paths or picker noise).
 */
type PhotoObservationMetadata = Pick<
  CameraResultData['metadata'],
  'width' | 'height' | 'size' | 'mimeType' | 'quality'
>;

function observationPhotoMetadataFromCamera(
  m: CameraResultData['metadata'],
): PhotoObservationMetadata {
  return {
    width: m.width,
    height: m.height,
    size: m.size,
    mimeType: m.mimeType,
    quality: m.quality,
  };
}

// Tester function to identify photo question types
export const photoQuestionTester = rankWith(
  5, // High priority for photo questions
  and(
    schemaTypeIs('object'),
    schemaMatches(schema => schema.format === 'photo'),
  ),
);

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface PhotoQuestionProps extends ControlProps {
  // Additional props specific to photo questions can be added here
}

const PhotoQuestionRenderer: React.FC<PhotoQuestionProps> = props => {
  const {
    data,
    handleChange,
    path,
    errors,
    schema,
    enabled = true,
    visible = true,
  } = props;

  const t = useOdeT();
  const [isLoading, setIsLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Safe error setter to prevent corruption
  const setSafeError = useCallback(
    (errorMessage: string | null) => {
      if (errorMessage === null || errorMessage === undefined) {
        setError(null);
      } else if (typeof errorMessage === 'string' && errorMessage.length > 0) {
        setError(errorMessage);
      } else {
        console.warn(
          'Invalid error message detected:',
          errorMessage,
          'Type:',
          typeof errorMessage,
        );
        setError(t('cqt.unknownError', 'Unknown error'));
      }
    },
    [t],
  );
  const formulusClient = useRef<FormulusClient>(FormulusClient.getInstance());

  // Extract field ID from the path for use with the camera interface
  const fieldId = path.replace(/\//g, '_').replace(/^_/, '') || 'photo_field';

  // Get the current photo data from the form data (now JSON format)
  const currentPhotoData = data || null;

  // Previews always come from the bridge — same contract as production (`resolveAttachmentDisplayUri` on RN).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      console.log('Photo data changed:', currentPhotoData);
      const base = attachmentBasenameFromObservation(
        currentPhotoData as Record<string, unknown> | null,
      );
      const resolved = await formulusClient.current.getAttachmentUri(
        base ?? null,
      );
      if (!cancelled) {
        const trimmed =
          resolved != null && resolved.trim() !== '' ? resolved.trim() : null;
        setPhotoUrl(trimmed);
        console.log('Resolved photo display URL:', resolved);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [currentPhotoData]);

  // Handle camera request with new Promise-based approach
  const handleTakePhoto = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setSafeError(null);

    try {
      console.log('Requesting camera for field:', fieldId);

      // Use the new Promise-based camera API
      const cameraResult: CameraResult =
        await formulusClient.current.requestCamera(fieldId);

      console.log('Camera result received:', cameraResult);

      // Check if the result was successful
      if (cameraResult.status === 'success' && cameraResult.data) {
        const storedBasename = attachmentBasenameFromFilename(
          cameraResult.data.filename,
        );
        if (!storedBasename) {
          setSafeError(
            t('media.invalidFilename', 'Invalid photo filename from camera.'),
          );
          return;
        }

        // Persist portable fields only — basename only; never persist bridge uri/url.
        const photoData = {
          id: cameraResult.data.id,
          type: cameraResult.data.type,
          filename: storedBasename,
          timestamp: cameraResult.data.timestamp,
          metadata: observationPhotoMetadataFromCamera(
            cameraResult.data.metadata,
          ),
        };
        console.log('Created photo data object for sync protocol:', {
          id: photoData.id,
          filename: photoData.filename,
          size: photoData.metadata.size,
        });

        console.log('Updating form data with photo data...');
        handleChange(path, photoData);

        console.log('Clearing error state after successful photo capture');
        setSafeError(null);

        console.log('Photo captured successfully:', photoData);
      } else {
        // Handle non-success results
        const errorMessage =
          cameraResult.message || `Camera operation ${cameraResult.status}`;
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
          const errorMessage =
            cameraError.message ||
            t('media.cameraError', 'Camera error occurred');
          console.log('Setting camera error message:', errorMessage);
          setSafeError(errorMessage);
        } else {
          setSafeError(t('media.unknownCameraError', 'Unknown camera error'));
        }
      } else {
        const errorMessage =
          err?.message ||
          err?.toString() ||
          t(
            'media.captureFailed',
            'Failed to capture photo. Please try again.',
          );
        console.log('Setting error message:', errorMessage);
        setSafeError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fieldId, enabled, handleChange, path, setSafeError, t]);

  // Handle photo deletion
  const handleDeletePhoto = useCallback(() => {
    if (!enabled) return;

    setPhotoUrl(null);
    handleChange(path, undefined);
    setSafeError(null);
    console.log('Photo deleted for field:', fieldId);
  }, [fieldId, handleChange, path, enabled, setSafeError]);

  const label = resolveControlLabel(props) || t('media.photo', 'Photo');
  const description = resolveControlDescription(props) ?? schema.description;
  const isRequired = Boolean(
    (props.uischema as any)?.options?.required ??
    (schema as any)?.options?.required ??
    false,
  );

  const validationError = formatControlErrors(errors);

  const displayBasename = attachmentBasenameFromObservation(
    currentPhotoData as Record<string, unknown> | null,
  );

  useClearOnHide({ visible, path, data, handleChange });
  if (visible === false) return null;

  return (
    <QuestionShell
      block
      title={label}
      description={description}
      required={isRequired}
      error={error || validationError}
      helperText={
        displayBasename
          ? undefined
          : t('media.captureHint', 'Capture a clear photo.')
      }
      metadata={
        process.env.NODE_ENV === 'development' ? (
          <Box
            sx={{
              p: 1,
              bgcolor: 'background.paper',
              borderRadius: `${parsePx(tokens.border.radius.md)}px`, // Match button border radius
              border: `${tokens.border.width.thin} solid`,
              borderColor: 'divider',
            }}>
            <Typography
              variant="caption"
              component="div"
              color="text.secondary">
              Debug Info:
            </Typography>
            <Typography
              variant="caption"
              component="pre"
              sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
              {JSON.stringify(
                {
                  fieldId,
                  path,
                  currentPhotoData,
                  hasPhotoData: !!currentPhotoData,
                  displayBasename,
                  hasDisplayBasename: !!displayBasename,
                  photoUrl,
                  hasPhotoUrl: !!photoUrl,
                  shouldShowThumbnail: !!(displayBasename && photoUrl),
                  isLoading,
                  error,
                },
                null,
                2,
              )}
            </Typography>
          </Box>
        ) : undefined
      }>
      {displayBasename && photoUrl ? (
        <Card sx={{ maxWidth: '100%' }}>
          <CardMedia
            component="img"
            height="200"
            image={photoUrl}
            alt={t('media.capturedPhotoAlt', 'Captured photo')}
            sx={{ objectFit: 'cover' }}
          />
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ flex: 1, mr: 1 }}>
                {displayBasename}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton
                  onClick={handleTakePhoto}
                  disabled={!enabled || isLoading}
                  color="primary"
                  size="small"
                  aria-label={t('media.retakePhoto', 'Retake photo')}>
                  <Refresh />
                </IconButton>
                <IconButton
                  onClick={handleDeletePhoto}
                  disabled={!enabled}
                  color="error"
                  size="small"
                  aria-label={t('media.deletePhoto', 'Delete photo')}>
                  <Delete />
                </IconButton>
              </Box>
            </Box>
          </CardContent>
        </Card>
      ) : (
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
            onClick={handleTakePhoto}
            disabled={!enabled || isLoading}
            color="primary"
            size="large"
            sx={{
              width: { xs: 56, sm: 64 },
              height: { xs: 56, sm: 64 },
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
            aria-label={t('media.takePhoto', 'Take photo')}>
            <PhotoCamera sx={{ fontSize: { xs: 28, sm: 32 } }} />
          </IconButton>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 2, textAlign: 'center' }}>
            {isLoading
              ? t('media.openingCamera', 'Opening camera...')
              : t('media.photoTap', 'Tap to capture photo')}
          </Typography>
        </Box>
      )}
    </QuestionShell>
  );
};

export default withJsonFormsControlProps(PhotoQuestionRenderer);
