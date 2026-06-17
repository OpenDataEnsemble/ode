import React, { useState, useCallback, useRef } from 'react';
import { Typography, Box, IconButton, CircularProgress } from '@mui/material';
import {
  AttachFile as FileIcon,
  Delete as DeleteIcon,
  InsertDriveFile as DocumentIcon,
} from '@mui/icons-material';
import { withJsonFormsControlProps } from '@jsonforms/react';
import {
  ControlProps,
  rankWith,
  schemaTypeIs,
  and,
  schemaMatches,
} from '@jsonforms/core';
import { tokens } from '../theme/tokens-adapter';
import {
  FileResult,
  FileResultData,
} from '../types/FormulusInterfaceDefinition';
import QuestionShell from '../components/QuestionShell';
import {
  attachmentBasenameFromFilename,
  attachmentBasenameFromObservation,
} from '../utils/attachmentBasename';
import FormulusClient from '../services/FormulusInterface';

const parsePx = (value: string): number =>
  parseInt(value.replace('px', ''), 10);

/** Portable metadata stored on the observation (no host paths). */
type FileObservationMetadata = Pick<FileResultData['metadata'], 'extension'> & {
  mimeType: string;
  size: number;
  originalFileName?: string;
};

function observationFileMetadataFromBridge(
  d: FileResultData,
): FileObservationMetadata {
  const out: FileObservationMetadata = {
    mimeType: d.mimeType,
    size: d.size,
    extension: d.metadata.extension,
  };
  if (
    typeof d.metadata.originalFileName === 'string' &&
    d.metadata.originalFileName.trim().length > 0
  ) {
    out.originalFileName = d.metadata.originalFileName.trim();
  }
  return out;
}

function fileObservationRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const o = data as Record<string, unknown>;
  return o.type === 'file' ? o : null;
}

function displayFilenameForFileObservation(
  obs: Record<string, unknown> | null,
): string {
  const basename = attachmentBasenameFromObservation(obs);
  const meta = obs?.metadata as Record<string, unknown> | undefined;
  const original =
    meta && typeof meta.originalFileName === 'string'
      ? meta.originalFileName.trim()
      : '';
  if (original.length > 0) {
    return original;
  }
  return basename ?? '';
}

export const fileQuestionTester = rankWith(
  5,
  and(
    schemaTypeIs('object'),
    schemaMatches(schema => schema.format === 'select_file'),
  ),
);

const FileQuestionRenderer: React.FC<ControlProps> = ({
  data,
  handleChange,
  path,
  errors,
  schema,
  uischema,
  enabled = true,
  visible = true,
}) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formulusClient = useRef(FormulusClient.getInstance());

  const fieldId = path.replace(/\//g, '_').replace(/^_/, '') || 'file_field';

  const setSafeError = useCallback((errorMessage: string | null) => {
    if (errorMessage === null || errorMessage === undefined) {
      setError(null);
    } else if (typeof errorMessage === 'string' && errorMessage.length > 0) {
      setError(errorMessage);
    } else {
      setError('An unknown error occurred');
    }
  }, []);

  const handleFileSelection = useCallback(async () => {
    if (!enabled) return;

    setIsSelecting(true);
    setSafeError(null);

    try {
      const result: FileResult =
        await formulusClient.current.requestFile(fieldId);

      if (result.status === 'success' && result.data) {
        const storedBasename = attachmentBasenameFromFilename(
          result.data.filename,
        );
        if (!storedBasename) {
          setSafeError('Invalid file name from picker.');
          return;
        }

        const portable = {
          type: 'file' as const,
          filename: storedBasename,
          timestamp: result.data.timestamp,
          ...observationFileMetadataFromBridge(result.data),
        };

        handleChange(path, portable);
        setSafeError(null);
      } else {
        const errorMessage =
          result.message || `File selection ${result.status}`;
        throw new Error(errorMessage);
      }
    } catch (err: unknown) {
      console.error('Error during file request:', err);

      if (err && typeof err === 'object' && 'status' in err) {
        const fr = err as FileResult;
        if (fr.status === 'cancelled') {
          setSafeError(null);
        } else if (fr.status === 'error') {
          setSafeError(fr.message || 'File selection failed');
        } else {
          setSafeError('Unknown file selection error');
        }
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'Failed to select file.';
        setSafeError(msg);
      }
    } finally {
      setIsSelecting(false);
    }
  }, [enabled, fieldId, handleChange, path, setSafeError]);

  const handleDelete = useCallback(() => {
    handleChange(path, undefined);
    setSafeError(null);
  }, [handleChange, path, setSafeError]);

  if (!visible) {
    return null;
  }

  const obs = fileObservationRecord(data);
  const hasData = obs !== null;
  const displayName = displayFilenameForFileObservation(obs);
  const validationError =
    errors && errors.length > 0 ? String(errors[0]) : null;

  const label = (uischema as { label?: string }).label ?? schema.title;
  const description = schema.description;
  const isRequired = Boolean(
    (uischema as { options?: { required?: boolean } }).options?.required ??
    (schema as { options?: { required?: boolean } }).options?.required,
  );

  return (
    <QuestionShell
      block
      title={label}
      description={description}
      required={isRequired}
      error={error || validationError}
      helperText={
        hasData && displayName
          ? undefined
          : 'Tap to attach a file. The observation stores the attachment key only.'
      }
      metadata={
        process.env.NODE_ENV === 'development' ? (
          <Box
            sx={{
              mt: 1,
              p: 1,
              bgcolor: 'info.light',
              borderRadius: `${parsePx(tokens.border.radius.md)}px`,
            }}>
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
              Debug: fieldId=&quot;{fieldId}&quot;, path=&quot;{path}&quot;,
              format=&quot;select_file&quot;
            </Typography>
          </Box>
        ) : undefined
      }>
      {!hasData && (
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
            onClick={() => void handleFileSelection()}
            disabled={!enabled || isSelecting}
            color="primary"
            size="large"
            sx={{
              width: { xs: 56, sm: 64 },
              height: { xs: 56, sm: 64 },
              backgroundColor: 'primary.main',
              color: 'white',
              '&:hover': { backgroundColor: 'primary.dark' },
              '&:disabled': {
                backgroundColor: 'action.disabledBackground',
                color: 'action.disabled',
              },
            }}
            aria-label="Select file">
            {isSelecting ? (
              <CircularProgress size={24} sx={{ color: 'white' }} />
            ) : (
              <FileIcon sx={{ fontSize: { xs: 28, sm: 32 } }} />
            )}
          </IconButton>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 2, textAlign: 'center' }}>
            {isSelecting ? 'Selecting file…' : 'Tap to select file'}
          </Typography>
        </Box>
      )}

      {hasData && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            py: 1,
            px: 1.5,
            borderRadius: `${parsePx(tokens.border.radius.md)}px`,
            border: `${tokens.border.width.thin} solid`,
            borderColor: 'divider',
            bgcolor: 'action.hover',
          }}>
          <DocumentIcon color="action" aria-hidden />
          <Typography
            variant="body2"
            sx={{
              flex: 1,
              minWidth: 0,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={displayName || undefined}>
            {displayName || 'Attached file'}
          </Typography>
          <IconButton
            onClick={() => void handleFileSelection()}
            disabled={!enabled || isSelecting}
            color="primary"
            size="small"
            aria-label="Replace file">
            {isSelecting ? (
              <CircularProgress size={18} />
            ) : (
              <FileIcon fontSize="small" />
            )}
          </IconButton>
          <IconButton
            onClick={handleDelete}
            disabled={!enabled}
            color="error"
            size="small"
            aria-label="Remove file">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    </QuestionShell>
  );
};

export default withJsonFormsControlProps(FileQuestionRenderer);
