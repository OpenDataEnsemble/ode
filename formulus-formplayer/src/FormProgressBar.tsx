import React, { useMemo } from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';

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
}

/**
 * Recursively count all question fields in the schema
 */
const countQuestions = (schema: JsonSchema | undefined, path: string = ''): number => {
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
        !(typeof fieldValue === 'object' && Object.keys(fieldValue).length === 0);

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
const FormProgressBar: React.FC<FormProgressBarProps> = ({
  currentPage,
  totalScreens,
  data,
  schema,
  uischema,
  mode = 'screens',
  isOnFinalizePage = false,
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

  if (totalScreens === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        width: '100%',
        mb: 2,
        px: { xs: 1, sm: 2 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            flexGrow: 1,
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              transition: 'transform 0.4s ease-in-out',
            },
          }}
        />
        <Typography
          variant="caption"
          sx={{
            minWidth: '45px',
            textAlign: 'right',
            color: 'text.secondary',
            fontWeight: 500,
          }}
        >
          {progress}%
        </Typography>
      </Box>
    </Box>
  );
};

export default FormProgressBar;
