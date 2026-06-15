import React, { ReactNode } from 'react';
import { Box, Typography, Alert, Stack, Divider, useTheme } from '@mui/material';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import { useFormDensity } from '../context/FormDensityContext';
import { tokens } from '../theme/tokens-adapter';

/**
 * Simple HTML sanitizer that removes dangerous tags and attributes.
 */
const sanitizeHtml = (html: string): string => {
  let sanitized = html.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    '',
  );
  sanitized = sanitized.replace(
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    '',
  );
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/\s*href\s*=\s*["']?\s*data:/gi, ' href="');
  sanitized = sanitized.replace(/\s*src\s*=\s*["']?\s*data:/gi, ' src="');

  return sanitized;
};

const renderHtmlContent = (content: string | undefined): React.ReactNode => {
  if (!content) return null;

  const htmlTagPattern = /<[a-z][a-z0-9]*(\s+[^>]*)?>/i;
  const hasHtmlTags = htmlTagPattern.test(content);

  if (hasHtmlTags) {
    try {
      const sanitized = sanitizeHtml(content);
      return <span dangerouslySetInnerHTML={{ __html: sanitized }} />;
    } catch (error) {
      console.error('Error rendering HTML content:', error);
      return content.replace(/<[^>]*>/g, '');
    }
  }

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
  /** Full-width layout (colspan 2) for large/media controls. */
  block?: boolean;
  /** Per-instance layout override from control `options.labelLayout`. */
  labelLayout?: 'inline' | 'stacked';
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
  block = false,
  labelLayout,
  children,
}) => {
  const theme = useTheme();
  const { labelLayout: contextLayout } = useFormDensity();
  const normalizedError = normalizeError(error);
  const isDark = theme.palette.mode === 'dark';
  const subtitleColor = isDark
    ? tokens.color.neutral[400]
    : tokens.color.neutral[600];

  const effectiveLayout = labelLayout ?? contextLayout;
  const useInline =
    !block && effectiveLayout === 'inline' && Boolean(title);

  const titleBlock = (title || description) && (
    <Stack spacing={0.5}>
      {title && (
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 700, lineHeight: 1.3, fontSize: '1rem' }}>
          {renderHtmlContent(title)}
          {required && (
            <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>
              *
            </Box>
          )}
        </Typography>
      )}
      {description && (
        <Typography
          variant="body2"
          sx={{ color: subtitleColor, lineHeight: 1.4 }}>
          {renderHtmlContent(description)}
        </Typography>
      )}
    </Stack>
  );

  const inputBlock = (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        minWidth: 0,
      }}>
      {children}
    </Box>
  );

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}>
      {useInline ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 38%) 1fr' },
            alignItems: 'start',
            columnGap: 2,
            rowGap: 1,
          }}>
          <Box sx={{ minWidth: 0 }}>{titleBlock}</Box>
          {inputBlock}
        </Box>
      ) : (
        <>
          {titleBlock}
          {inputBlock}
        </>
      )}

      {normalizedError && (
        <Alert
          severity="error"
          icon={<ErrorOutline />}
          sx={{
            width: '100%',
            mb: -1,
            backgroundColor: 'transparent',
            color: 'error.main',
            '& .MuiAlert-icon': { color: 'error.main' },
          }}>
          {normalizedError}
        </Alert>
      )}

      {(helperText || actions) && (
        <Stack spacing={1}>
          {helperText && (
            <Typography variant="body2" sx={{ color: subtitleColor }}>
              {typeof helperText === 'string'
                ? renderHtmlContent(helperText)
                : helperText}
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
