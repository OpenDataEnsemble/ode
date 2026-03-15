import React, { useState, useCallback, useEffect, useRef } from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import {
  ControlProps,
  rankWith,
  schemaTypeIs,
  and,
  schemaMatches,
} from '@jsonforms/core';
import {
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  Button,
  FormControl,
  InputLabel,
} from '@mui/material';
import { CalendarToday } from '@mui/icons-material';
import QuestionShell from '../components/QuestionShell';
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
  uischema: _uischema,
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
  const skipNextSync = useRef(true);
  const lastWrittenData = useRef<string | null>(null);

  // Initialize from data (skip if we wrote it ourselves)
  // Bidirectional sync pattern: skipNextSync ref prevents cascading renders
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (data === lastWrittenData.current) return;
    skipNextSync.current = true;
    if (data && typeof data === 'string') {
      const adateFormat = storageFormatToAdate(data);
      if (adateFormat) {
        const upperAdate = adateFormat.toUpperCase();
        const dayMatch = upperAdate.match(/D:(\d+|NS)/);
        const monthMatch = upperAdate.match(/M:(\d+|NS)/);
        const yearMatch = upperAdate.match(/Y:(\d+|NS)/);

        if (dayMatch) {
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
      setDay('');
      setMonth('');
      setYear('');
      setDayUnknown(false);
      setMonthUnknown(false);
      setYearUnknown(false);
    }
  }, [data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Sync form data whenever state changes
  useEffect(() => {
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }

    // Nothing entered yet — don't store
    if (
      !day &&
      !month &&
      !year &&
      !dayUnknown &&
      !monthUnknown &&
      !yearUnknown
    ) {
      lastWrittenData.current = '';
      handleChange(path, '');
      return;
    }

    const dayValue = dayUnknown ? 'NS' : day || 'NS';
    const monthValue = monthUnknown ? 'NS' : month || 'NS';
    const yearValue = yearUnknown ? 'NS' : year || 'NS';

    const adateString = `D:${dayValue},M:${monthValue},Y:${yearValue}`;
    const storageFormat = adateToStorageFormat(adateString);
    lastWrittenData.current = storageFormat || '';
    handleChange(path, storageFormat || '');
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
  const handleDayChange = useCallback((event: any) => {
    setDay(event.target.value as string);
  }, []);

  // Handle month change
  const handleMonthChange = useCallback((event: any) => {
    setMonth(event.target.value as string);
  }, []);

  // Handle year change
  const handleYearChange = useCallback((event: any) => {
    setYear(event.target.value as string);
  }, []);

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
  }, []);

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
  }, []);

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
            <FormControl
              size="small"
              fullWidth
              disabled={!enabled || dayUnknown}>
              <InputLabel>Day</InputLabel>
              <Select label="Day" value={day} onChange={handleDayChange}>
                <MenuItem value="">
                  <em>--</em>
                </MenuItem>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <MenuItem key={d} value={String(d)}>
                    {d}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <input
                type="checkbox"
                checked={dayUnknown}
                onChange={e => {
                  setDayUnknown(e.target.checked);
                  if (e.target.checked) setDay('');
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
            <FormControl
              size="small"
              fullWidth
              disabled={!enabled || monthUnknown}>
              <InputLabel>Month</InputLabel>
              <Select label="Month" value={month} onChange={handleMonthChange}>
                <MenuItem value="">
                  <em>--</em>
                </MenuItem>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <MenuItem key={m} value={String(m)}>
                    {m}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <input
                type="checkbox"
                checked={monthUnknown}
                onChange={e => {
                  setMonthUnknown(e.target.checked);
                  if (e.target.checked) setMonth('');
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
            <FormControl
              size="small"
              fullWidth
              disabled={!enabled || yearUnknown}>
              <InputLabel>Year</InputLabel>
              <Select label="Year" value={year} onChange={handleYearChange}>
                <MenuItem value="">
                  <em>--</em>
                </MenuItem>
                {Array.from(
                  { length: new Date().getFullYear() - 1899 },
                  (_, i) => new Date().getFullYear() - i,
                ).map(y => (
                  <MenuItem key={y} value={String(y)}>
                    {y}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <input
                type="checkbox"
                checked={yearUnknown}
                onChange={e => {
                  setYearUnknown(e.target.checked);
                  if (e.target.checked) setYear('');
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
          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Current value: <strong>{displayValue}</strong>
            </Typography>
          </Box>
        )}

        {/* Validation errors */}
        {hasError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {Array.isArray(errors) ? errors.join(', ') : String(errors)}
          </Alert>
        )}
      </Box>
    </QuestionShell>
  );
};

export default withJsonFormsControlProps(AdateQuestionRenderer);
