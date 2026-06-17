import React, { ReactNode } from 'react';
import {
  Box,
  Typography,
  Alert,
  Stack,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
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

/** Shared typography for inline label + plain value text (computed read-only, etc.). */
const INLINE_TEXT_SX = {
  fontSize: '1rem',
  lineHeight: 1.375,
  m: 0,
  p: 0,
} as const;

/** Vertical padding inside each inline row — keeps content clear of row dividers. */
const INLINE_ROW_PY = 1.5;

/** Label column band — CSS Grid `minmax(min, max)` on the first track. */
const INLINE_LABEL_MIN_WIDTH = '28%';
const INLINE_LABEL_MAX_WIDTH = '48%';

/** Reset theme field margins inside inline value cells. */
const inlineValueCellSx = {
  minWidth: 0,
  py: INLINE_ROW_PY,
  '& .MuiFormControl-root, & .MuiTextField-root': {
    marginTop: 0,
    marginBottom: 0,
  },
  '& .MuiToggleButtonGroup-root': {
    marginTop: 0,
    marginBottom: 0,
  },
} as const;

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
  const useInline = !block && effectiveLayout === 'inline' && Boolean(title);
  const labelVerticalAlign = description ? 'top' : 'middle';

  const rowDividerColor = isDark
    ? tokens.color.neutral[600]
    : tokens.color.neutral[300];

  const titleBlock = (title || description) && (
    <Stack spacing={0.5}>
      {title && (
        <Typography
          component="div"
          variant="subtitle1"
          sx={{ ...INLINE_TEXT_SX, fontWeight: 700 }}>
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
          component="div"
          variant="body2"
          sx={{ color: subtitleColor, lineHeight: 1.4, m: 0 }}>
          {renderHtmlContent(description)}
        </Typography>
      )}
    </Stack>
  );

  const stackedInputBlock = (
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
        ...(useInline && {
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '1px',
            background: `linear-gradient(90deg, transparent 0%, ${alpha(rowDividerColor, isDark ? 0.45 : 0.65)} 18%, ${alpha(rowDividerColor, isDark ? 0.45 : 0.65)} 82%, transparent 100%)`,
            pointerEvents: 'none',
          },
        }),
      }}>
      {useInline ? (
        <Box
          sx={{
            display: { xs: 'flex', sm: 'grid' },
            flexDirection: { xs: 'column', sm: 'unset' },
            width: '100%',
            gridTemplateColumns: {
              sm: `minmax(${INLINE_LABEL_MIN_WIDTH}, ${INLINE_LABEL_MAX_WIDTH}) minmax(0, 1fr)`,
            },
            columnGap: { sm: 2 },
            rowGap: { xs: 1 },
            alignItems: {
              sm: labelVerticalAlign === 'top' ? 'start' : 'center',
            },
          }}>
          <Box sx={{ minWidth: 0, py: INLINE_ROW_PY, pr: { sm: 2 } }}>
            {titleBlock}
          </Box>
          <Box sx={inlineValueCellSx}>{children}</Box>
        </Box>
      ) : (
        <>
          {titleBlock}
          {stackedInputBlock}
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
export { INLINE_TEXT_SX };
