import React, { useMemo, useCallback } from 'react';
import { Box, IconButton, LinearProgress, Typography } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { tokens } from '../theme/tokens-adapter';

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, any>;
  [key: string]: any;
};

interface FormProgressBarProps {
  /**
   * Current page index (0-based)
   */
  currentPage: number;
  /**
   * Total number of screens/pages in the form (including Finalize screen)
   */
  totalScreens: number;
  /**
   * Form data to calculate progress based on answered questions
   */
  data?: Record<string, any>;
  /**
   * Form schema to identify all questions
   */
  schema?: JsonSchema;
  /**
   * UI schema to identify screens
   */
  uischema?: any;
  /**
   * Progress calculation mode: 'screens' or 'questions'
   * 'screens': Based on screens completed
   * 'questions': Based on questions answered
   */
  mode?: 'screens' | 'questions' | 'both';
  /**
   * Whether the user is currently on the Finalize page
   */
  isOnFinalizePage?: boolean;
  /**
   * Optional narrow prev/next controls flanking the bar. Use the same callbacks
   * as primary navigation (not `.click()` on other buttons) to avoid double events.
   */
  onNavigatePrevious?: () => void;
  onNavigateNext?: () => void;
  /** When true, both header chevrons are disabled (e.g. navigation in flight). */
  navigationDisabled?: boolean;
}

/**
 * Recursively count all question fields in the schema
 */
const countQuestions = (
  schema: JsonSchema | undefined,
  path: string = '',
): number => {
  if (!schema || !schema.properties) {
    return 0;
  }

  let count = 0;
  const properties = schema.properties;

  for (const [key, value] of Object.entries(properties)) {
    const currentPath = path ? `${path}.${key}` : key;
    const fieldSchema = value as JsonSchema;

    if (fieldSchema.type === 'object' && fieldSchema.properties) {
      count += countQuestions(fieldSchema, currentPath);
    } else {
      if (fieldSchema.format !== 'finalize') {
        count++;
      }
    }
  }

  return count;
};

/**
 * Recursively count answered questions in the data
 */
const countAnsweredQuestions = (
  schema: JsonSchema | undefined,
  data: Record<string, any>,
  path: string = '',
): number => {
  if (!schema || !schema.properties || !data) {
    return 0;
  }

  let count = 0;
  const properties = schema.properties;

  for (const [key, value] of Object.entries(properties)) {
    const currentPath = path ? `${path}.${key}` : key;
    const fieldSchema = value as JsonSchema;
    const fieldValue = data[key];

    if (fieldSchema.type === 'object' && fieldSchema.properties) {
      if (fieldValue && typeof fieldValue === 'object') {
        count += countAnsweredQuestions(fieldSchema, fieldValue, currentPath);
      }
    } else {
      const isAnswered =
        fieldValue !== undefined &&
        fieldValue !== null &&
        fieldValue !== '' &&
        !(Array.isArray(fieldValue) && fieldValue.length === 0) &&
        !(
          typeof fieldValue === 'object' && Object.keys(fieldValue).length === 0
        );

      if (isAnswered && fieldSchema.format !== 'finalize') {
        count++;
      }
    }
  }

  return count;
};

/**
 * FormProgressBar component that displays form completion progress
 */
const navIconButtonSx = {
  flexShrink: 0,
  p: 0.25,
  color: 'text.secondary',
  '&.Mui-disabled': { opacity: 0.35 },
} as const;

const FormProgressBar: React.FC<FormProgressBarProps> = ({
  currentPage,
  totalScreens,
  data,
  schema,
  mode = 'screens',
  isOnFinalizePage = false,
  onNavigatePrevious,
  onNavigateNext,
  navigationDisabled = false,
}) => {
  const progress = useMemo(() => {
    if (mode === 'screens' || mode === 'both') {
      if (totalScreens === 0) return 0;

      if (isOnFinalizePage) {
        return 100;
      }

      const completedScreens = currentPage + 1;
      const screenProgress = (completedScreens / totalScreens) * 100;

      if (mode === 'screens') {
        return Math.round(screenProgress);
      }

      if (schema && data) {
        const totalQuestions = countQuestions(schema);
        const answeredQuestions = countAnsweredQuestions(schema, data);
        const questionProgress =
          totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;

        return Math.round((screenProgress + questionProgress) / 2);
      }

      return Math.round(screenProgress);
    } else if (mode === 'questions') {
      if (!schema || !data) return 0;

      const totalQuestions = countQuestions(schema);
      if (totalQuestions === 0) return 0;

      const answeredQuestions = countAnsweredQuestions(schema, data);
      return Math.round((answeredQuestions / totalQuestions) * 100);
    }

    return 0;
  }, [currentPage, totalScreens, data, schema, mode, isOnFinalizePage]);

  const handlePrev = useCallback(() => {
    if (navigationDisabled || !onNavigatePrevious) return;
    onNavigatePrevious();
  }, [navigationDisabled, onNavigatePrevious]);

  const handleNext = useCallback(() => {
    if (navigationDisabled || !onNavigateNext) return;
    onNavigateNext();
  }, [navigationDisabled, onNavigateNext]);

  if (totalScreens === 0) {
    return null;
  }

  const showHeaderNav = onNavigatePrevious != null || onNavigateNext != null;

  return (
    <Box
      sx={{
        width: '100%',
        mb: 1,
        px: 0,
      }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 0.25, sm: 0.5 },
          mb: 0.5,
          px: { xs: 0.5, sm: 1 },
        }}>
        {showHeaderNav ? (
          <IconButton
            type="button"
            size="small"
            aria-label="Previous screen"
            onClick={handlePrev}
            disabled={navigationDisabled || !onNavigatePrevious}
            edge="start"
            sx={navIconButtonSx}>
            <ChevronLeft sx={{ fontSize: 22 }} />
          </IconButton>
        ) : null}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flex: 1,
            minWidth: 0,
          }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              flexGrow: 1,
              height: 8,
              borderRadius: 4,
              backgroundColor: `rgba(0, 0, 0, ${(tokens as any).opacity?.['10'] ?? 0.1})`,
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                transition: 'transform 0.4s ease-in-out',
              },
            }}
          />
          <Typography
            variant="caption"
            sx={{
              flexShrink: 0,
              minWidth: '2.25rem',
              textAlign: 'right',
              color: 'text.secondary',
              fontWeight: 500,
            }}>
            {progress}%
          </Typography>
        </Box>
        {showHeaderNav ? (
          <IconButton
            type="button"
            size="small"
            aria-label="Next screen"
            onClick={handleNext}
            disabled={navigationDisabled || !onNavigateNext}
            edge="end"
            sx={navIconButtonSx}>
            <ChevronRight sx={{ fontSize: 22 }} />
          </IconButton>
        ) : null}
      </Box>
    </Box>
  );
};

export default FormProgressBar;
