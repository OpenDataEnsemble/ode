import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
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
  Paper,
  IconButton,
  LinearProgress,
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
import FormulusClient from '../services/FormulusInterface';
import {
  AudioResult,
  AudioResultData,
} from '../types/FormulusInterfaceDefinition';
import QuestionShell from '../components/QuestionShell';
import { tokens } from '../theme/tokens-adapter';
import {
  attachmentBasenameFromFilename,
  attachmentBasenameFromObservation,
} from '../utils/attachmentBasename';

const parsePx = (value: string): number =>
  parseInt(value.replace('px', ''), 10);

type AudioObservationMetadata = Pick<
  AudioResultData['metadata'],
  'duration' | 'format' | 'size' | 'sampleRate' | 'channels'
>;

function observationAudioMetadataFromBridge(
  m: AudioResultData['metadata'],
): AudioObservationMetadata {
  const out: AudioObservationMetadata = {
    duration: m.duration,
    format: m.format,
    size: m.size,
  };
  if (m.sampleRate != null) {
    out.sampleRate = m.sampleRate;
  }
  if (m.channels != null) {
    out.channels = m.channels;
  }
  return out;
}

export const audioQuestionTester = rankWith(
  10,
  and(
    schemaTypeIs('object'),
    schemaMatches(schema => schema.format === 'audio'),
  ),
);

function legacyPlayableUrl(
  data: Record<string, unknown> | null,
): string | null {
  if (!data) {
    return null;
  }
  const url = data.url;
  if (typeof url === 'string' && /^https?:\/\//i.test(url.trim())) {
    return url.trim();
  }
  const uri = data.uri;
  if (typeof uri === 'string') {
    const u = uri.trim();
    if (
      /^https?:\/\//i.test(u) ||
      u.startsWith('blob:') ||
      u.startsWith('data:')
    ) {
      return u;
    }
  }
  return null;
}

const AudioQuestionRenderer: React.FC<ControlProps> = ({
  data,
  handleChange,
  path,
  schema,
  uischema,
  errors,
  enabled = true,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  const setSafeError = useCallback((errorMessage: string | null) => {
    if (errorMessage === null || errorMessage === undefined) {
      setError(null);
    } else if (typeof errorMessage === 'string' && errorMessage.length > 0) {
      setError(errorMessage);
    } else {
      setError('An unknown error occurred');
    }
  }, []);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const formulusClient = useRef(FormulusClient.getInstance());

  const fieldId = path.replace(/\//g, '_').replace(/^_/, '') || 'audio_field';

  const currentAudioData = useMemo(() => {
    if (
      data &&
      typeof data === 'object' &&
      (data as { type?: string }).type === 'audio'
    ) {
      return data as Record<string, unknown>;
    }
    return null;
  }, [data]);

  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const base = attachmentBasenameFromObservation(currentAudioData);
      let resolved: string | null = null;
      if (base) {
        const r = await formulusClient.current.getAttachmentUri(base);
        resolved = r != null && r.trim() !== '' ? r.trim() : null;
      }
      if (!resolved) {
        resolved = legacyPlayableUrl(currentAudioData);
      }
      if (!cancelled) {
        setMediaUrl(resolved);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [currentAudioData]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

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

    const handleAudioError = () => {
      setSafeError('Failed to load audio');
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleAudioError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleAudioError);
    };
  }, [currentAudioData, mediaUrl, setSafeError]);

  const handleRecord = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setSafeError(null);
    setIsLoading(true);

    try {
      const result: AudioResult =
        await formulusClient.current.requestAudio(fieldId);

      if (result.status === 'success' && result.data) {
        const storedBasename = attachmentBasenameFromFilename(
          result.data.filename,
        );
        if (!storedBasename) {
          setSafeError('Invalid audio filename from recorder.');
          return;
        }

        const audioPayload = {
          type: 'audio' as const,
          filename: storedBasename,
          timestamp: result.data.timestamp,
          metadata: observationAudioMetadataFromBridge(result.data.metadata),
        };

        handleChange(path, audioPayload);
        setSafeError(null);
      } else if (result.status === 'cancelled') {
        setSafeError(null);
      } else {
        setSafeError(result.message || 'Audio recording failed');
      }
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'status' in err &&
        (err as AudioResult).status === 'cancelled'
      ) {
        setSafeError(null);
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'object' &&
                err !== null &&
                'message' in err &&
                typeof (err as { message?: string }).message === 'string'
              ? (err as { message: string }).message
              : 'Failed to record audio';
        setSafeError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [enabled, fieldId, handleChange, path, setSafeError]);

  const handlePlay = () => {
    const audio = audioRef.current;
    if (!audio || !currentAudioData) {
      return;
    }

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
          progressInterval.current = setInterval(() => {
            setCurrentTime(audio.currentTime);
          }, 100);
        })
        .catch(() => {
          setSafeError('Failed to play audio');
        });
    }
  };

  const handleStop = () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

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
    handleChange(path, undefined);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setSafeError(null);
    setMediaUrl(null);
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
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const displayBasename = attachmentBasenameFromObservation(currentAudioData);

  const validationError =
    errors && Array.isArray(errors) && errors.length > 0
      ? errors
          .map((e: { message?: string } | string) =>
            typeof e === 'object' && e?.message ? e.message : String(e),
          )
          .join(', ')
      : null;

  const meta = currentAudioData?.metadata as
    | AudioObservationMetadata
    | undefined;

  const label =
    (uischema as { label?: string })?.label || schema.title || 'Audio';
  const description = schema.description;
  const isRequired = Boolean(
    (uischema as { options?: { required?: boolean } })?.options?.required ??
    (schema as { options?: { required?: boolean } })?.options?.required ??
    false,
  );

  const hasAudio =
    !!displayBasename &&
    !!currentAudioData &&
    typeof meta?.duration === 'number';

  return (
    <QuestionShell block
      title={label}
      description={description}
      required={isRequired}
      error={error || validationError}
      helperText={
        displayBasename
          ? `File: ${displayBasename}`
          : 'Record clear audio. You can re-record or delete as needed.'
      }>
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          borderRadius: `${parsePx(tokens.border.radius.md)}px`,
          backgroundColor: hasAudio ? 'background.paper' : 'grey.50',
        }}>
        {!hasAudio ? (
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
              onClick={handleRecord}
              disabled={!enabled || isLoading}
              color="primary"
              size="large"
              sx={{
                width: { xs: 56, sm: 64 },
                height: { xs: 56, sm: 64 },
                backgroundColor: isLoading
                  ? 'action.disabledBackground'
                  : 'primary.main',
                color: 'white',
                '&:hover': {
                  backgroundColor: isLoading
                    ? 'action.disabledBackground'
                    : 'primary.dark',
                },
                '&:disabled': {
                  backgroundColor: 'action.disabledBackground',
                  color: 'action.disabled',
                },
              }}
              aria-label="Record audio">
              <MicIcon sx={{ fontSize: { xs: 28, sm: 32 } }} />
            </IconButton>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 2, textAlign: 'center' }}>
              {isLoading ? 'Recording...' : 'Tap to record audio'}
            </Typography>
            {isLoading && (
              <LinearProgress sx={{ mt: 2, width: '100%', maxWidth: 200 }} />
            )}
          </Box>
        ) : (
          <Box>
            <audio
              ref={audioRef}
              src={mediaUrl ?? undefined}
              preload="metadata"
            />

            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {displayBasename}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip
                  label={`${formatTime(meta?.duration ?? 0)}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={(meta?.format ?? 'audio').toUpperCase()}
                  size="small"
                  variant="outlined"
                />
                {meta?.size != null && (
                  <Chip
                    label={getFileSizeString(meta.size)}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
            </Box>

            <Box sx={{ mb: 2 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{ height: 6, borderRadius: 3 }}
              />
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mt: 0.5,
                }}>
                <Typography variant="caption" color="text.secondary">
                  {formatTime(currentTime)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatTime(duration || (meta?.duration ?? 0))}
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 2 }}>
              <IconButton
                onClick={handlePlay}
                disabled={!enabled || !mediaUrl}
                sx={{
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': { backgroundColor: 'primary.dark' },
                }}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </IconButton>

              <IconButton
                onClick={handleStop}
                disabled={!enabled || (!isPlaying && currentTime === 0)}
                sx={{
                  backgroundColor: 'grey.600',
                  color: 'white',
                  '&:hover': { backgroundColor: 'grey.700' },
                  '&:disabled': {
                    backgroundColor: 'grey.300',
                    color: 'grey.500',
                  },
                }}>
                <StopIcon />
              </IconButton>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
              <IconButton
                onClick={handleRecord}
                disabled={!enabled || isLoading}
                color="primary"
                size="small"
                aria-label="Re-record">
                <RefreshIcon />
              </IconButton>
              <IconButton
                onClick={handleDelete}
                disabled={!enabled}
                color="error"
                size="small"
                aria-label="Delete">
                <DeleteIcon />
              </IconButton>
            </Box>

            {process.env.NODE_ENV === 'development' && (
              <Box
                sx={{
                  mt: 2,
                  p: 1,
                  backgroundColor: 'grey.100',
                  borderRadius: `${parsePx(tokens.border.radius.md)}px`,
                }}>
                <Typography variant="caption" color="text.secondary">
                  <strong>Dev:</strong> mediaUrl={mediaUrl ?? 'null'}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Paper>
    </QuestionShell>
  );
};

export default withJsonFormsControlProps(AudioQuestionRenderer);
