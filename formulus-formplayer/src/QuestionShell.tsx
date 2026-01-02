import React, { ReactNode } from 'react';
import { Box, Typography, Alert, Stack, Divider } from '@mui/material';

/**
 * Simple HTML sanitizer that removes dangerous tags and attributes.
 * This is a lightweight alternative that doesn't require external dependencies.
 */
const sanitizeHtml = (html: string): string => {
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove style tags and their content
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');
  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:/gi, '');
  // Remove data: URLs in href/src (potential XSS vector)
  sanitized = sanitized.replace(/\s*href\s*=\s*["']?\s*data:/gi, ' href="');
  sanitized = sanitized.replace(/\s*src\s*=\s*["']?\s*data:/gi, ' src="');

  return sanitized;
};

/**
 * Renders content with basic HTML support.
 * Detects HTML tags and renders them safely using dangerouslySetInnerHTML.
 * Falls back to plain text for non-HTML content.
 */
const renderHtmlContent = (content: string | undefined): React.ReactNode => {
  if (!content) return null;

  // Check for HTML tags - looks for < followed by a letter (tag start)
  const htmlTagPattern = /<[a-z][a-z0-9]*(\s+[^>]*)?>/i;
  const hasHtmlTags = htmlTagPattern.test(content);

  if (hasHtmlTags) {
    try {
      const sanitized = sanitizeHtml(content);
      return <span dangerouslySetInnerHTML={{ __html: sanitized }} />;
    } catch (error) {
      // If sanitization fails, strip all HTML tags
      console.error('Error rendering HTML content:', error);
      return content.replace(/<[^>]*>/g, '');
    }
  }

  // No HTML tags detected, render as plain text
  return content;
};

export interface QuestionShellProps {
  title?: string;
  description?: string;
  required?: boolean;
  error?: string | string[] | null;
  helperText?: ReactNode;
  actions?: ReactNode;
  metadata?: ReactNode;
  children: ReactNode;
}

const normalizeError = (error?: string | string[] | null): string | null => {
  if (!error) return null;
  if (Array.isArray(error)) {
    return error.filter(Boolean).join(', ') || null;
  }
  return error;
};

const QuestionShell: React.FC<QuestionShellProps> = ({
  title,
  description,
  required = false,
  error,
  helperText,
  actions,
  metadata,
  children,
}) => {
  const normalizedError = normalizeError(error);

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      {(title || description) && (
        <Stack spacing={0.5}>
          {title && (
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {renderHtmlContent(title)}
              {required && (
                <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>
                  *
                </Box>
              )}
            </Typography>
          )}
          {description && (
            <Typography variant="body1" color="text.secondary">
              {renderHtmlContent(description)}
            </Typography>
          )}
        </Stack>
      )}

      {normalizedError && (
        <Alert severity="error" sx={{ width: '100%' }}>
          {normalizedError}
        </Alert>
      )}

      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {children}
      </Box>

      {(helperText || actions) && (
        <Stack spacing={1}>
          {helperText && (
            <Typography variant="body2" color="text.secondary">
              {typeof helperText === 'string' ? renderHtmlContent(helperText) : helperText}
            </Typography>
          )}
          {actions}
        </Stack>
      )}

      {metadata && (
        <Stack spacing={1}>
          <Divider />
          <Box>{metadata}</Box>
        </Stack>
      )}
    </Box>
  );
};

export default QuestionShell;
