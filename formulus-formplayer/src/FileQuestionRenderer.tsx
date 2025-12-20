import React, { useState, useCallback, useRef } from 'react';
import {
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Paper,
  IconButton,
  Chip,
} from '@mui/material';
import {
  AttachFile as FileIcon,
  Delete as DeleteIcon,
  InsertDriveFile as DocumentIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Description as TextIcon,
} from '@mui/icons-material';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { ControlProps, rankWith, schemaTypeIs, and, schemaMatches } from '@jsonforms/core';
import FormulusClient from './FormulusInterface';
import { FileResult } from './FormulusInterfaceDefinition';

// Tester function - determines when this renderer should be used
export const fileQuestionTester = rankWith(
  5, // Priority (higher = more specific)
  and(
    schemaTypeIs('object'), // Expects object data type
    schemaMatches((schema) => schema.format === 'select_file'), // Matches format
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
  // State management
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const formulusClient = useRef(FormulusClient.getInstance());

  // Extract field ID from path
  const fieldId = path.split('.').pop() || path;

  // Handle file selection via React Native
  const handleFileSelection = useCallback(async () => {
    setIsSelecting(true);
    setError(null);

    try {
      const result: FileResult = await formulusClient.current.requestFile(fieldId);

      if (result.status === 'success' && result.data) {
        // Update form data with the file result
        handleChange(path, result.data);
      }
    } catch (err: any) {
      if (err.status === 'cancelled') {
        // User cancelled - don't show error
        console.log('File selection cancelled by user');
      } else if (err.status === 'error') {
        setError(err.message || 'File selection failed');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsSelecting(false);
    }
  }, [fieldId, handleChange, path]);

  // Handle delete/clear
  const handleDelete = useCallback(() => {
    handleChange(path, null);
    setError(null);
  }, [handleChange, path]);

  // Get file icon based on MIME type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon sx={{ color: '#4CAF50' }} />;
    } else if (mimeType === 'application/pdf') {
      return <PdfIcon sx={{ color: '#F44336' }} />;
    } else if (
      mimeType.startsWith('text/') ||
      mimeType.includes('document') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('presentation')
    ) {
      return <TextIcon sx={{ color: '#2196F3' }} />;
    } else {
      return <DocumentIcon sx={{ color: '#9E9E9E' }} />;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file type label
  const getFileTypeLabel = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) {
      return 'Image';
    } else if (mimeType === 'application/pdf') {
      return 'PDF';
    } else if (mimeType.includes('document')) {
      return 'Document';
    } else if (mimeType.includes('spreadsheet')) {
      return 'Spreadsheet';
    } else if (mimeType.includes('presentation')) {
      return 'Presentation';
    } else if (mimeType.startsWith('text/')) {
      return 'Text';
    } else {
      return 'File';
    }
  };

  // Don't render if not visible
  if (!visible) {
    return null;
  }

  const hasData = data && typeof data === 'object' && data.type === 'file';
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

      {/* File Selection Button */}
      {!hasData && (
        <Button
          variant="contained"
          startIcon={isSelecting ? <CircularProgress size={20} /> : <FileIcon />}
          onClick={handleFileSelection}
          disabled={!enabled || isSelecting}
          fullWidth
          sx={{ mb: 2 }}
        >
          {isSelecting ? 'Selecting File...' : 'Select File'}
        </Button>
      )}

      {/* File Display */}
      {hasData && (
        <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {getFileIcon(data.mimeType)}
                <Box sx={{ ml: 2, flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {data.filename}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={getFileTypeLabel(data.mimeType)}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    <Chip label={formatFileSize(data.size)} size="small" variant="outlined" />
                    {data.metadata.extension && (
                      <Chip
                        label={`.${data.metadata.extension.toUpperCase()}`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                <strong>URI:</strong> {data.uri}
              </Typography>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                <strong>MIME Type:</strong> {data.mimeType}
              </Typography>

              {data.metadata.originalPath && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  <strong>Original Path:</strong> {data.metadata.originalPath}
                </Typography>
              )}

              {/* Replace File Button */}
              <Button
                variant="outlined"
                startIcon={<FileIcon />}
                onClick={handleFileSelection}
                disabled={!enabled || isSelecting}
                size="small"
                sx={{ mt: 2 }}
              >
                Replace File
              </Button>
            </Box>

            <IconButton onClick={handleDelete} disabled={!enabled} size="small" sx={{ ml: 1 }}>
              <DeleteIcon />
            </IconButton>
          </Box>
        </Paper>
      )}

      {/* Development Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <Box sx={{ mt: 2, p: 1, bgcolor: 'info.light', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
            Debug: fieldId="{fieldId}", path="{path}", format="select_file"
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default withJsonFormsControlProps(FileQuestionRenderer);
