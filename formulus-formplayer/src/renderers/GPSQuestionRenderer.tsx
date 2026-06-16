import React, { useState, useMemo, useRef, useCallback } from 'react';
import { rankWith, ControlProps, formatIs } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Divider,
  IconButton,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  MyLocation as MyLocationIcon,
} from '@mui/icons-material';
import QuestionShell from '../components/QuestionShell';
import { tokens } from '../theme/tokens-adapter';
import FormulusClient from '../services/FormulusInterface';
import type { LocationResult } from '../types/FormulusInterfaceDefinition';

// Helper to parse pixel values from tokens
const parsePx = (value: string): number => {
  return parseInt(value.replace('px', ''), 10);
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface GPSQuestionRendererProps extends ControlProps {
  // Additional props if needed
}

interface LocationDisplayData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  timestamp: string;
}

function parseLocationDisplayData(data: unknown): LocationDisplayData | null {
  if (!data || typeof data !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(data);
    if (
      parsed &&
      typeof parsed.latitude === 'number' &&
      typeof parsed.longitude === 'number'
    ) {
      return parsed as LocationDisplayData;
    }
  } catch (e) {
    console.warn('Failed to parse existing location data:', e);
  }
  return null;
}

const GPSQuestionRenderer: React.FC<GPSQuestionRendererProps> = props => {
  const { data, handleChange, path, errors, schema, enabled } = props;

  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formulusClient = useRef(FormulusClient.getInstance());

  const fieldId = path.replace(/\//g, '_').replace(/^_/, '') || 'gps_field';

  const locationData = useMemo(() => parseLocationDisplayData(data), [data]);

  const handleCaptureLocation = useCallback(async () => {
    if (!enabled) return;

    setIsCapturing(true);
    setError(null);

    try {
      const result: LocationResult =
        await formulusClient.current.requestLocation(fieldId);

      if (result.status === 'success' && result.data) {
        const stored: LocationDisplayData = {
          latitude: result.data.latitude,
          longitude: result.data.longitude,
          accuracy: result.data.accuracy,
          altitude: result.data.altitude ?? undefined,
          altitudeAccuracy: result.data.altitudeAccuracy ?? undefined,
          timestamp: result.data.timestamp,
        };
        handleChange(path, JSON.stringify(stored));
      } else {
        const msg =
          result.message ||
          (result.status === 'cancelled'
            ? 'Location capture was cancelled'
            : 'Could not capture location');
        throw new Error(msg);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err) {
        const lr = err as LocationResult;
        if (lr.status === 'cancelled') {
          setError(null);
        } else if (lr.status === 'error') {
          setError(lr.message || 'Location capture failed');
        } else {
          setError('Location capture failed');
        }
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'Location capture failed. Check permissions and try again.';
        setError(msg);
      }
    } finally {
      setIsCapturing(false);
    }
  }, [enabled, fieldId, handleChange, path]);

  const handleDeleteLocation = () => {
    setError(null);
    handleChange(path, undefined);
  };

  const formatCoordinate = (coord: number, type: 'lat' | 'lng'): string => {
    const direction =
      type === 'lat' ? (coord >= 0 ? 'N' : 'S') : coord >= 0 ? 'E' : 'W';
    return `${Math.abs(coord).toFixed(6)}° ${direction}`;
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      console.error('Failed to format timestamp:', e);
      return timestamp;
    }
  };

  const hasValidationErrors = errors && errors.length > 0;
  const isDisabled = !enabled || isCapturing;

  return (
    <QuestionShell
      block
      title={schema.title || 'GPS Location'}
      description={schema.description}
      required={Boolean(
        (props.uischema as any)?.options?.required ??
        (schema as any)?.options?.required,
      )}
      error={
        error ||
        (hasValidationErrors
          ? Array.isArray(errors)
            ? errors
                .map((error: any) => error.message || String(error))
                .join(', ')
            : errors
          : null)
      }
      helperText="Tap to capture this point with the device GPS. The observation may also include a separate location when you submit."
      metadata={
        process.env.NODE_ENV === 'development' ? (
          <Box
            sx={{
              mt: 1,
              p: 1,
              bgcolor: 'grey.100',
              borderRadius: `${parsePx(tokens.border.radius.md)}px`,
            }}>
            <Typography variant="caption" color="text.secondary">
              Debug - Path: {path} | Data: {JSON.stringify(data)}
            </Typography>
          </Box>
        ) : undefined
      }>
      {locationData ? (
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <LocationIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6" component="div">
                Location Captured
              </Typography>
              <Box sx={{ ml: 'auto' }}>
                <Chip
                  label="GPS"
                  color="success"
                  size="small"
                  icon={<MyLocationIcon />}
                />
              </Box>
            </Box>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Latitude
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {formatCoordinate(locationData.latitude, 'lat')}
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Longitude
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {formatCoordinate(locationData.longitude, 'lng')}
                </Typography>
              </Grid>

              {locationData.accuracy !== undefined && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Accuracy
                  </Typography>
                  <Typography variant="body1">
                    ±{locationData.accuracy.toFixed(1)} meters
                  </Typography>
                </Grid>
              )}

              {locationData.altitude !== undefined &&
                locationData.altitude !== null && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      Altitude
                    </Typography>
                    <Typography variant="body1">
                      {locationData.altitude.toFixed(1)} meters
                      {locationData.altitudeAccuracy && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: 1 }}>
                          (±{locationData.altitudeAccuracy.toFixed(1)}m)
                        </Typography>
                      )}
                    </Typography>
                  </Grid>
                )}

              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Captured at: {formatTimestamp(locationData.timestamp)}
                </Typography>
              </Grid>
            </Grid>

            {/* Action Buttons */}
            <Box
              sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center' }}>
              <IconButton
                onClick={handleCaptureLocation}
                disabled={isDisabled}
                color="primary"
                size="small"
                aria-label="Re-capture location">
                <RefreshIcon />
              </IconButton>
              <IconButton
                onClick={handleDeleteLocation}
                disabled={isDisabled}
                color="error"
                size="small"
                aria-label="Delete location">
                <DeleteIcon />
              </IconButton>
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
            onClick={handleCaptureLocation}
            disabled={isDisabled}
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
            aria-label="Capture GPS location">
            {isCapturing ? (
              <CircularProgress size={24} sx={{ color: 'white' }} />
            ) : (
              <LocationIcon sx={{ fontSize: { xs: 28, sm: 32 } }} />
            )}
          </IconButton>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 2, textAlign: 'center' }}>
            {isCapturing
              ? 'Capturing location...'
              : 'Tap to capture GPS location'}
          </Typography>
        </Box>
      )}
    </QuestionShell>
  );
};

// Tester function to determine when this renderer should be used
export const gpsQuestionTester = rankWith(
  10, // Priority - higher than default string renderer
  formatIs('gps'),
);

export default withJsonFormsControlProps(GPSQuestionRenderer);
