import React, { useState, useCallback, useEffect } from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import {
  ControlProps,
  rankWith,
  schemaTypeIs,
  and,
  schemaMatches,
} from '@jsonforms/core';
import { TextField, Box, Typography, Alert, Button } from '@mui/material';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import { CalendarToday } from '@mui/icons-material';
import QuestionShell from '../components/QuestionShell';
import { tokens } from '../theme/tokens-adapter';

// Helper to parse pixel values from tokens
const parsePx = (value: string): number => {
  return parseInt(value.replace('px', ''), 10);
};

import {
  adateToStorageFormat,
  storageFormatToAdate,
  displayAdate,
  todayAdate,
  yesterdayAdate,
} from '../utils/adateUtils';

// Tester function - determines when this renderer should be used
export const adateQuestionTester = rankWith(
  5, // Priority (higher = more specific)
  and(
    schemaTypeIs('string'), // Expects string data type
    schemaMatches(schema => schema.format === 'adate'), // Matches format
  ),
);

const AdateQuestionRenderer: React.FC<ControlProps> = ({
  data,
  handleChange,
  path,
  errors,
  schema,
  enabled = true,
  visible = true,
}) => {
  // State for date components
  const [day, setDay] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [dayUnknown, setDayUnknown] = useState<boolean>(false);
  const [monthUnknown, setMonthUnknown] = useState<boolean>(false);
  const [yearUnknown, setYearUnknown] = useState<boolean>(false);

  // Initialize from data
  useEffect(() => {
    if (data && typeof data === 'string') {
      // Convert storage format to adate format for editing
      const adateFormat = storageFormatToAdate(data);
      if (adateFormat) {
        const upperAdate = adateFormat.toUpperCase();
        const dayMatch = upperAdate.match(/D:(\d+|NS)/);
        const monthMatch = upperAdate.match(/M:(\d+|NS)/);
        const yearMatch = upperAdate.match(/Y:(\d+|NS)/);

        if (dayMatch) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setDayUnknown(dayMatch[1] === 'NS');
          setDay(dayMatch[1] === 'NS' ? '' : dayMatch[1]);
        }
        if (monthMatch) {
          setMonthUnknown(monthMatch[1] === 'NS');
          setMonth(monthMatch[1] === 'NS' ? '' : monthMatch[1]);
        }
        if (yearMatch) {
          setYearUnknown(yearMatch[1] === 'NS');
          setYear(yearMatch[1] === 'NS' ? '' : yearMatch[1]);
        }
      }
    } else {
      // Initialize empty
      setDay('');
      setMonth('');
      setYear('');
      setDayUnknown(false);
      setMonthUnknown(false);
      setYearUnknown(false);
    }
  }, [data]);

  // Update form data when components change
  const updateFormData = useCallback(() => {
    const dayValue = dayUnknown ? 'NS' : day;
    const monthValue = monthUnknown ? 'NS' : month;
    const yearValue = yearUnknown ? 'NS' : year;

    // Build adate string
    const adateString = `D:${dayValue},M:${monthValue},Y:${yearValue}`;

    // Convert to storage format and save
    const storageFormat = adateToStorageFormat(adateString);
    if (storageFormat) {
      handleChange(path, storageFormat);
    } else {
      handleChange(path, '');
    }
  }, [
    day,
    month,
    year,
    dayUnknown,
    monthUnknown,
    yearUnknown,
    handleChange,
    path,
  ]);

  // Handle day change
  const handleDayChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (
        value === '' ||
        (/^\d+$/.test(value) &&
          parseInt(value, 10) >= 1 &&
          parseInt(value, 10) <= 31)
      ) {
        setDay(value);
        updateFormData();
      }
    },
    [updateFormData],
  );

  // Handle month change
  const handleMonthChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (
        value === '' ||
        (/^\d+$/.test(value) &&
          parseInt(value, 10) >= 1 &&
          parseInt(value, 10) <= 12)
      ) {
        setMonth(value);
        updateFormData();
      }
    },
    [updateFormData],
  );

  // Handle year change
  const handleYearChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (value === '' || /^\d{4}$/.test(value)) {
        setYear(value);
        updateFormData();
      }
    },
    [updateFormData],
  );

  // Handle quick date buttons
  const handleToday = useCallback(() => {
    const today = todayAdate();
    const upperAdate = today.toUpperCase();
    const dayMatch = upperAdate.match(/D:(\d+)/);
    const monthMatch = upperAdate.match(/M:(\d+)/);
    const yearMatch = upperAdate.match(/Y:(\d+)/);

    if (dayMatch) setDay(dayMatch[1]);
    if (monthMatch) setMonth(monthMatch[1]);
    if (yearMatch) setYear(yearMatch[1]);
    setDayUnknown(false);
    setMonthUnknown(false);
    setYearUnknown(false);
    updateFormData();
  }, [updateFormData]);

  const handleYesterday = useCallback(() => {
    const yesterday = yesterdayAdate();
    const upperAdate = yesterday.toUpperCase();
    const dayMatch = upperAdate.match(/D:(\d+)/);
    const monthMatch = upperAdate.match(/M:(\d+)/);
    const yearMatch = upperAdate.match(/Y:(\d+)/);

    if (dayMatch) setDay(dayMatch[1]);
    if (monthMatch) setMonth(monthMatch[1]);
    if (yearMatch) setYear(yearMatch[1]);
    setDayUnknown(false);
    setMonthUnknown(false);
    setYearUnknown(false);
    updateFormData();
  }, [updateFormData]);

  // Don't render if not visible
  if (!visible) {
    return null;
  }

  const hasError =
    errors && (Array.isArray(errors) ? errors.length > 0 : errors.length > 0);
  const displayValue = data ? displayAdate(data) : '';
  const errorMessage = hasError
    ? Array.isArray(errors)
      ? errors.join(', ')
      : String(errors)
    : undefined;

  return (
    <QuestionShell
      title={schema.title || 'Approximate Date'}
      description={schema.description}
      required={schema.required?.includes(path.split('.').pop() || '')}
      error={errorMessage}>
      <Box sx={{ mb: 2 }}>
        {/* Quick date buttons */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CalendarToday />}
            onClick={handleToday}
            disabled={!enabled}>
            Today
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={handleYesterday}
            disabled={!enabled}>
            Yesterday
          </Button>
        </Box>

        {/* Date input fields */}
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}>
          {/* Day */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              minWidth: 120,
            }}>
            <TextField
              label="Day"
              value={day}
              onChange={handleDayChange}
              disabled={!enabled || dayUnknown}
              type="number"
              inputProps={{ min: 1, max: 31 }}
              size="small"
              fullWidth
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <input
                type="checkbox"
                checked={dayUnknown}
                onChange={e => {
                  setDayUnknown(e.target.checked);
                  if (e.target.checked) setDay('');
                  updateFormData();
                }}
                disabled={!enabled}
                style={{ cursor: enabled ? 'pointer' : 'not-allowed' }}
              />
              <Typography variant="caption">Unknown</Typography>
            </Box>
          </Box>

          {/* Month */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              minWidth: 120,
            }}>
            <TextField
              label="Month"
              value={month}
              onChange={handleMonthChange}
              disabled={!enabled || monthUnknown}
              type="number"
              inputProps={{ min: 1, max: 12 }}
              size="small"
              fullWidth
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <input
                type="checkbox"
                checked={monthUnknown}
                onChange={e => {
                  setMonthUnknown(e.target.checked);
                  if (e.target.checked) setMonth('');
                  updateFormData();
                }}
                disabled={!enabled}
                style={{ cursor: enabled ? 'pointer' : 'not-allowed' }}
              />
              <Typography variant="caption">Unknown</Typography>
            </Box>
          </Box>

          {/* Year */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              minWidth: 120,
            }}>
            <TextField
              label="Year"
              value={year}
              onChange={handleYearChange}
              disabled={!enabled || yearUnknown}
              type="number"
              inputProps={{ min: 1000, max: 9999 }}
              size="small"
              fullWidth
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <input
                type="checkbox"
                checked={yearUnknown}
                onChange={e => {
                  setYearUnknown(e.target.checked);
                  if (e.target.checked) setYear('');
                  updateFormData();
                }}
                disabled={!enabled}
                style={{ cursor: enabled ? 'pointer' : 'not-allowed' }}
              />
              <Typography variant="caption">Unknown</Typography>
            </Box>
          </Box>
        </Box>

        {/* Display current value */}
        {displayValue && displayValue !== 'n/a' && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              bgcolor: 'grey.50',
              borderRadius: `${parsePx(tokens.border.radius.md)}px`,
            }}>
            <Typography variant="body2" color="text.secondary">
              Current value: <strong>{displayValue}</strong>
            </Typography>
          </Box>
        )}

        {/* Validation errors – same as QuestionShell: icon, no background, text color matches icon */}
        {hasError && (
          <Alert
            severity="error"
            icon={<ErrorOutline />}
            sx={{
              mt: 2,
              backgroundColor: 'transparent',
              color: 'error.main',
              '& .MuiAlert-icon': { color: 'error.main' },
            }}>
            {Array.isArray(errors) ? errors.join(', ') : String(errors)}
          </Alert>
        )}
      </Box>
    </QuestionShell>
  );
};

export default withJsonFormsControlProps(AdateQuestionRenderer);
