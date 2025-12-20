import React, { useState, useEffect } from 'react';
import { rankWith, ControlProps, formatIs } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import {
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  Chip,
  Alert,
  Grid,
  Divider,
} from '@mui/material';
import {
  Videocam as VideocamIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  VideoFile as VideoFileIcon,
} from '@mui/icons-material';
// Note: The shared Formulus interface v1.1.0 no longer exposes a
// requestVideo() API. This renderer therefore does not actively
// trigger native video recording anymore. It can still display
// existing video metadata if present in the form data.

interface VideoQuestionRendererProps extends ControlProps {
  // Additional props if needed
}

interface VideoDisplayData {
  filename: string;
  uri: string;
  timestamp: string;
  metadata: {
    duration: number;
    format: string;
    size: number;
    width?: number;
    height?: number;
  };
}

const VideoQuestionRenderer: React.FC<VideoQuestionRendererProps> = (props) => {
  const { data, handleChange, path, errors, schema, enabled } = props;

  const [videoData, setVideoData] = useState<VideoDisplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  // Parse existing video data if present
  useEffect(() => {
    if (data && typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (parsed && parsed.filename && parsed.uri) {
          setVideoData(parsed);
        }
      } catch (e) {
        console.warn('Failed to parse existing video data:', e);
      }
    }
  }, [data]);

  const handleRecordVideo = async () => {
    // The current Formulus interface version does not provide a
    // requestVideo() API. Surface a clear message so users are not
    // confused when pressing the button.
    setError('Video recording is not supported in this version of the app.');
  };

  const handleDeleteVideo = () => {
    setVideoData(null);
    setError(null);
    setIsPlaying(false);
    if (videoElement) {
      videoElement.pause();
      videoElement.currentTime = 0;
    }
    handleChange(path, undefined);
  };

  const handlePlayPause = () => {
    if (!videoElement || !videoData) return;

    if (isPlaying) {
      videoElement.pause();
      setIsPlaying(false);
    } else {
      videoElement.play();
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    if (!videoElement) return;

    videoElement.pause();
    videoElement.currentTime = 0;
    setIsPlaying(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return timestamp;
    }
  };

  const hasValidationErrors = errors && errors.length > 0;
  const isDisabled = !enabled;

  return (
    <Box sx={{ mb: 2 }}>
      {/* Field Label */}
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>
        {schema.title || 'Video Recording'}
      </Typography>

      {/* Field Description */}
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
      {hasValidationErrors && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {Array.isArray(errors) ? errors.map((error: any) => error.message).join(', ') : errors}
        </Alert>
      )}

      {/* Video Display or Record Button */}
      {videoData ? (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <VideoFileIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6" component="div">
                Video Recorded
              </Typography>
              <Box sx={{ ml: 'auto' }}>
                <Chip
                  label={videoData.metadata.format.toUpperCase()}
                  color="success"
                  size="small"
                  icon={<VideocamIcon />}
                />
              </Box>
            </Box>

            {/* Video Player */}
            <Box sx={{ mb: 2, textAlign: 'center' }}>
              <video
                ref={setVideoElement}
                src={videoData.uri}
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  height: 'auto',
                  borderRadius: '8px',
                  backgroundColor: '#000',
                }}
                onEnded={() => setIsPlaying(false)}
                onLoadedMetadata={() => {
                  // Video loaded successfully
                }}
                onError={() => {
                  console.warn(
                    'Video playback error - this is expected in development with mock URIs',
                  );
                }}
              />
            </Box>

            {/* Video Controls */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2 }}>
              <Button
                variant="outlined"
                startIcon={isPlaying ? <PauseIcon /> : <PlayIcon />}
                onClick={handlePlayPause}
                disabled={isDisabled}
                size="small"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<StopIcon />}
                onClick={handleStop}
                disabled={isDisabled}
                size="small"
              >
                Stop
              </Button>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Filename
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                  {videoData.filename}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Duration
                </Typography>
                <Typography variant="body1">
                  {formatDuration(videoData.metadata.duration)}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  File Size
                </Typography>
                <Typography variant="body1">{formatFileSize(videoData.metadata.size)}</Typography>
              </Grid>

              {videoData.metadata.width && videoData.metadata.height && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Resolution
                  </Typography>
                  <Typography variant="body1">
                    {videoData.metadata.width} × {videoData.metadata.height}
                  </Typography>
                </Grid>
              )}

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Recorded at: {formatTimestamp(videoData.timestamp)}
                </Typography>
              </Grid>
            </Grid>

            {/* Action Buttons */}
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRecordVideo}
                disabled={isDisabled}
                size="small"
              >
                Re-record
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDeleteVideo}
                disabled={isDisabled}
                size="small"
              >
                Delete
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Box>
          <Button
            variant="contained"
            startIcon={<VideocamIcon />}
            onClick={handleRecordVideo}
            disabled={isDisabled}
            fullWidth
            sx={{
              py: 1.5,
              fontSize: '1rem',
              textTransform: 'none',
            }}
          >
            Record Video
          </Button>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: 'block', textAlign: 'center' }}
          >
            This will open your device's camera to record a video
          </Typography>
        </Box>
      )}

      {/* Debug Information (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Debug - Path: {path} | Data: {JSON.stringify(data)}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// Tester function to determine when this renderer should be used
export const videoQuestionTester = rankWith(
  10, // Priority - higher than default string renderer
  formatIs('video'),
);

export default withJsonFormsControlProps(VideoQuestionRenderer);
