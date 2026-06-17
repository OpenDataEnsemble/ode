import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  rankWith,
  ControlProps,
  schemaTypeIs,
  and,
  schemaMatches,
} from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { tokens } from '../theme/tokens-adapter';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
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
import QuestionShell from '../components/QuestionShell';
import FormulusClient from '../services/FormulusInterface';
import {
  VideoResult,
  VideoResultData,
} from '../types/FormulusInterfaceDefinition';
import {
  attachmentBasenameFromFilename,
  attachmentBasenameFromObservation,
} from '../utils/attachmentBasename';

const parsePx = (value: string): number =>
  parseInt(value.replace('px', ''), 10);

type VideoObservationMetadata = Pick<
  VideoResultData['metadata'],
  'duration' | 'format' | 'size' | 'width' | 'height'
>;

function observationVideoMetadataFromBridge(
  m: VideoResultData['metadata'],
): VideoObservationMetadata {
  const out: VideoObservationMetadata = {
    duration: m.duration,
    format: m.format,
    size: m.size,
  };
  if (m.width != null) {
    out.width = m.width;
  }
  if (m.height != null) {
    out.height = m.height;
  }
  return out;
}

export const videoQuestionTester = rankWith(
  10,
  and(
    schemaTypeIs('object'),
    schemaMatches(schema => schema.format === 'video'),
  ),
);

function legacyVideoPlayableUrl(
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

const VideoQuestionRenderer: React.FC<ControlProps> = ({
  data,
  handleChange,
  path,
  errors,
  schema,
  uischema,
  enabled = true,
  visible = true,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const formulusClient = useRef(FormulusClient.getInstance());

  const setSafeError = useCallback((errorMessage: string | null) => {
    if (errorMessage === null || errorMessage === undefined) {
      setError(null);
    } else if (typeof errorMessage === 'string' && errorMessage.length > 0) {
      setError(errorMessage);
    } else {
      setError('An unknown error occurred');
    }
  }, []);

  const fieldId = path.replace(/\//g, '_').replace(/^_/, '') || 'video_field';

  const currentVideoData = useMemo(() => {
    if (data && typeof data === 'object') {
      const r = data as Record<string, unknown>;
      if (r.type === 'video') {
        return r;
      }
    }
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data) as unknown;
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed as { type?: string }).type === 'video'
        ) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        /* legacy string payloads ignored */
      }
    }
    return null;
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const base = attachmentBasenameFromObservation(currentVideoData);
      let resolved: string | null = null;
      if (base) {
        const r = await formulusClient.current.getAttachmentUri(base);
        resolved = r != null && r.trim() !== '' ? r.trim() : null;
      }
      if (!resolved) {
        resolved = legacyVideoPlayableUrl(currentVideoData);
      }
      if (!cancelled) {
        setMediaUrl(resolved);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [currentVideoData]);

  const handleRecordVideo = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setSafeError(null);
    setIsLoading(true);

    try {
      const result: VideoResult =
        await formulusClient.current.requestVideo(fieldId);

      if (result.status === 'success' && result.data) {
        const storedBasename = attachmentBasenameFromFilename(
          result.data.filename,
        );
        if (!storedBasename) {
          setSafeError('Invalid video filename from recorder.');
          return;
        }

        handleChange(path, {
          type: 'video' as const,
          filename: storedBasename,
          timestamp: result.data.timestamp,
          metadata: observationVideoMetadataFromBridge(result.data.metadata),
        });
        setSafeError(null);
      } else if (result.status === 'cancelled') {
        setSafeError(null);
      } else {
        setSafeError(result.message || 'Video recording failed');
      }
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'status' in err &&
        (err as VideoResult).status === 'cancelled'
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
              : 'Failed to record video';
        setSafeError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [enabled, fieldId, handleChange, path, setSafeError]);

  const handleDeleteVideo = () => {
    setSafeError(null);
    setIsPlaying(false);
    setMediaUrl(null);
    if (videoElementRef.current) {
      videoElementRef.current.pause();
      videoElementRef.current.currentTime = 0;
    }
    handleChange(path, undefined);
  };

  const handlePlayPause = () => {
    const el = videoElementRef.current;
    if (!el || !currentVideoData) {
      return;
    }

    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      void el
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setSafeError('Failed to play video');
        });
    }
  };

  const handleStop = () => {
    const el = videoElementRef.current;
    if (!el) {
      return;
    }
    el.pause();
    el.currentTime = 0;
    setIsPlaying(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const displayBasename = attachmentBasenameFromObservation(currentVideoData);

  const meta = currentVideoData?.metadata as
    | VideoObservationMetadata
    | undefined;

  const hasValidationErrors = errors && errors.length > 0;
  const validationError = hasValidationErrors
    ? Array.isArray(errors)
      ? errors
          .map((e: { message?: string } | string) =>
            typeof e === 'object' && e && 'message' in e && e.message
              ? String(e.message)
              : String(e),
          )
          .join(', ')
      : String(errors)
    : null;

  const label =
    (uischema as { label?: string })?.label ||
    schema.title ||
    'Video Recording';
  const description = schema.description;
  const isRequired = Boolean(
    (uischema as { options?: { required?: boolean } })?.options?.required ??
    (schema as { options?: { required?: boolean } })?.options?.required ??
    false,
  );

  const hasVideo =
    !!displayBasename &&
    !!currentVideoData &&
    typeof meta?.duration === 'number';

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
          ? `File: ${displayBasename}`
          : 'Capture a video if required.'
      }
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
              Debug — path: {path} | mediaUrl: {mediaUrl ?? 'null'}
            </Typography>
          </Box>
        ) : undefined
      }>
      {hasVideo ? (
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <VideoFileIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6" component="div">
                Video recorded
              </Typography>
              <Box sx={{ ml: 'auto' }}>
                <Chip
                  label={(meta?.format ?? 'video').toUpperCase()}
                  color="success"
                  size="small"
                  icon={<VideocamIcon />}
                />
              </Box>
            </Box>

            <Box sx={{ mb: 2, textAlign: 'center' }}>
              <video
                ref={videoElementRef}
                src={mediaUrl ?? undefined}
                style={{
                  width: '100%',
                  maxWidth: 560,
                  height: 'auto',
                  borderRadius: tokens.border.radius.md,
                  backgroundColor: tokens.color.neutral.black,
                }}
                onEnded={() => setIsPlaying(false)}
                onError={() => {
                  setSafeError('Failed to load video');
                }}
              />
            </Box>

            <Box
              sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2 }}>
              <IconButton
                onClick={handlePlayPause}
                disabled={!enabled || !mediaUrl}
                color="primary"
                size="small"
                aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
              <IconButton
                onClick={handleStop}
                disabled={!enabled}
                size="small"
                aria-label="Stop">
                <StopIcon />
              </IconButton>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Filename
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                  {displayBasename}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Duration
                </Typography>
                <Typography variant="body1">
                  {formatDuration(meta?.duration ?? 0)}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">
                  File size
                </Typography>
                <Typography variant="body1">
                  {meta?.size != null ? formatFileSize(meta.size) : '—'}
                </Typography>
              </Box>

              {meta?.width != null && meta?.height != null && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Resolution
                  </Typography>
                  <Typography variant="body1">
                    {meta.width} × {meta.height}
                  </Typography>
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Recorded at:{' '}
              {typeof currentVideoData?.timestamp === 'string'
                ? formatTimestamp(currentVideoData.timestamp)
                : '—'}
            </Typography>

            <Box
              sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center' }}>
              <IconButton
                onClick={handleRecordVideo}
                disabled={!enabled || isLoading}
                color="primary"
                size="small"
                aria-label="Re-record">
                <RefreshIcon />
              </IconButton>
              <IconButton
                onClick={handleDeleteVideo}
                disabled={!enabled}
                color="error"
                size="small"
                aria-label="Delete">
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
            onClick={handleRecordVideo}
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
            aria-label="Record video">
            <VideocamIcon sx={{ fontSize: { xs: 28, sm: 32 } }} />
          </IconButton>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 2, textAlign: 'center' }}>
            {isLoading ? 'Opening camera...' : 'Tap to record video'}
          </Typography>
        </Box>
      )}
    </QuestionShell>
  );
};

export default withJsonFormsControlProps(VideoQuestionRenderer);
