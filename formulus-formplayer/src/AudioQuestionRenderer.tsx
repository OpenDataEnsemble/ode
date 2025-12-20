import React, { useState, useRef, useEffect } from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { ControlProps, rankWith, formatIs } from '@jsonforms/core';
import {
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
  LinearProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  Mic as MicIcon,
  Stop as StopIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import FormulusClient from './FormulusInterface';
import { AudioResult } from './FormulusInterfaceDefinition';

interface AudioQuestionRendererProps extends ControlProps {
  data: any;
  handleChange(path: string, value: any): void;
  path: string;
}

interface AudioData {
  type: 'audio';
  filename: string;
  uri: string;
  timestamp: string;
  metadata: {
    duration: number;
    format: string;
    size: number;
  };
}

const AudioQuestionRenderer: React.FC<AudioQuestionRendererProps> = ({
  data,
  handleChange,
  path,
  schema,
  uischema,
  errors,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const audioData: AudioData | null =
    data && typeof data === 'object' && data.type === 'audio' ? data : null;
  const hasAudio = !!audioData;

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  // Handle audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    };

    const handleError = () => {
      setError('Failed to load audio file');
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioData]);

  const handleRecord = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const fieldId = path.replace(/\./g, '_');
      console.log('Requesting audio recording for field:', fieldId);

      const result: AudioResult = await FormulusClient.getInstance().requestAudio(fieldId);

      if (result.status === 'success' && result.data) {
        console.log('Audio recording successful:', result);
        handleChange(path, result.data);
      } else if (result.status === 'cancelled') {
        console.log('Audio recording cancelled');
        // Don't show error for cancellation
      } else {
        console.error('Audio recording failed:', result);
        setError(result.message || 'Audio recording failed');
      }
    } catch (error: any) {
      console.error('Audio recording error:', error);
      if (error.status === 'cancelled') {
        // Don't show error for cancellation
      } else {
        setError(error.message || 'Failed to record audio');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = () => {
    const audio = audioRef.current;
    if (!audio || !audioData) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    } else {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          // Update progress more frequently for smoother UI
          progressInterval.current = setInterval(() => {
            setCurrentTime(audio.currentTime);
          }, 100);
        })
        .catch((error) => {
          console.error('Failed to play audio:', error);
          setError('Failed to play audio');
        });
    }
  };

  const handleStop = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  };

  const handleDelete = () => {
    handleChange(path, null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setError(null);
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFileSizeString = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Box sx={{ mb: 2 }}>
      {/* Label */}
      {schema.title && (
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
          {schema.title}
          {schema.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {schema.description}
            </Typography>
          )}
        </Typography>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Validation Errors */}
      {errors && Array.isArray(errors) && errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.map((error: any) => error.message).join(', ')}
        </Alert>
      )}

      <Paper
        variant="outlined"
        sx={{
          p: 3,
          borderRadius: 2,
          backgroundColor: hasAudio ? 'background.paper' : 'grey.50',
        }}
      >
        {!hasAudio ? (
          // Recording State
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ mb: 2 }}>
              <IconButton
                size="large"
                sx={{
                  width: 80,
                  height: 80,
                  backgroundColor: isLoading ? 'grey.300' : 'error.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: isLoading ? 'grey.400' : 'error.dark',
                  },
                  '&:disabled': {
                    backgroundColor: 'grey.300',
                    color: 'grey.500',
                  },
                }}
                onClick={handleRecord}
                disabled={isLoading}
              >
                <MicIcon sx={{ fontSize: 40 }} />
              </IconButton>
            </Box>

            <Typography variant="h6" sx={{ mb: 1 }}>
              {isLoading ? 'Recording...' : 'Record Audio'}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {isLoading
                ? 'Please speak into your microphone'
                : 'Tap the microphone to start recording'}
            </Typography>

            {isLoading && <LinearProgress sx={{ mb: 2 }} />}

            <Button
              variant="contained"
              startIcon={<MicIcon />}
              onClick={handleRecord}
              disabled={isLoading}
              size="large"
            >
              {isLoading ? 'Recording...' : 'Start Recording'}
            </Button>
          </Box>
        ) : (
          // Playback State
          <Box>
            {/* Audio element (hidden) */}
            <audio ref={audioRef} src={audioData.uri} preload="metadata" />

            {/* Audio Info */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                🎵 {audioData.filename}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip
                  label={`${formatTime(audioData.metadata.duration)}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={audioData.metadata.format.toUpperCase()}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={getFileSizeString(audioData.metadata.size)}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </Box>

            {/* Progress Bar */}
            <Box sx={{ mb: 2 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{ height: 6, borderRadius: 3 }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {formatTime(currentTime)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatTime(duration || audioData.metadata.duration)}
                </Typography>
              </Box>
            </Box>

            {/* Control Buttons */}
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 2 }}>
              <IconButton
                onClick={handlePlay}
                sx={{
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': { backgroundColor: 'primary.dark' },
                }}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </IconButton>

              <IconButton
                onClick={handleStop}
                disabled={!isPlaying && currentTime === 0}
                sx={{
                  backgroundColor: 'grey.600',
                  color: 'white',
                  '&:hover': { backgroundColor: 'grey.700' },
                  '&:disabled': { backgroundColor: 'grey.300', color: 'grey.500' },
                }}
              >
                <StopIcon />
              </IconButton>
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRecord}
                disabled={isLoading}
              >
                Re-record
              </Button>

              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
              >
                Delete
              </Button>
            </Box>

            {/* Development Info */}
            {process.env.NODE_ENV === 'development' && (
              <Box sx={{ mt: 2, p: 1, backgroundColor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  <strong>Dev Info:</strong> {audioData.uri}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

// Tester function to determine when this renderer should be used
export const audioQuestionTester = rankWith(
  10, // High priority
  formatIs('audio'),
);

export default withJsonFormsControlProps(AudioQuestionRenderer);
