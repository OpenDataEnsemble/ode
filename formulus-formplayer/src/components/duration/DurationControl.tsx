import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  LinearProgress,
  TextField,
  Typography,
  Stack,
} from '@mui/material';
import { tokens } from '../../theme/tokens-adapter';
import {
  formatDurationSeconds,
  parseDurationConfig,
  type DurationConfig,
} from './durationFormat';
import { useFormContext } from '../../App';
import { useNumericDraftInput } from '../../hooks/useNumericDraftInput';

export interface DurationControlProps {
  value: unknown;
  onChange: (value: unknown) => void;
  schema: Record<string, unknown>;
  enabled: boolean;
  hasError: boolean;
}

type TimerPhase = 'idle' | 'running' | 'paused';

export default function DurationControl({
  value,
  onChange,
  schema,
  enabled,
  hasError,
}: DurationControlProps) {
  const config: DurationConfig = parseDurationConfig(schema);
  const mode = config.mode ?? 'stopwatch';
  const precision = config.precision ?? 1;
  const allowManualEntry = config.allowManualEntry !== false;
  const countdownFrom =
    typeof config.countdownFrom === 'number' ? config.countdownFrom : null;

  const { keyboardEnterKeyHint } = useFormContext();

  const savedSeconds =
    typeof value === 'number' && !Number.isNaN(value) ? value : undefined;

  const [phase, setPhase] = useState<TimerPhase>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCountdown = mode === 'countdown' && countdownFrom != null;
  const displayMs = isCountdown
    ? Math.max(0, countdownFrom! * 1000 - elapsedMs)
    : elapsedMs;
  const displaySeconds = displayMs / 1000;

  const stopInterval = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const syncElapsed = useCallback(() => {
    if (startRef.current == null) return;
    setElapsedMs(
      accumulatedRef.current + (performance.now() - startRef.current),
    );
  }, []);

  useEffect(() => stopInterval, [stopInterval]);

  const pauseTimer = () => {
    if (startRef.current == null) return;
    accumulatedRef.current += performance.now() - startRef.current;
    startRef.current = null;
    stopInterval();
    setElapsedMs(accumulatedRef.current);
    setPhase('paused');
  };

  useEffect(() => {
    if (
      isCountdown &&
      phase === 'running' &&
      countdownFrom != null &&
      displaySeconds <= 0
    ) {
      pauseTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pause when countdown completes
  }, [isCountdown, phase, countdownFrom, displaySeconds]);

  const startTimer = () => {
    if (!enabled) return;
    startRef.current = performance.now();
    setPhase('running');
    stopInterval();
    intervalRef.current = setInterval(syncElapsed, 100);
  };

  const resetTimer = () => {
    if (phase === 'running') {
      const ok = window.confirm('Discard the current timing?');
      if (!ok) return;
    }
    stopInterval();
    startRef.current = null;
    accumulatedRef.current = 0;
    setElapsedMs(0);
    setPhase('idle');
  };

  const saveTimer = () => {
    const factor = 10 ** precision;
    const seconds = Math.round((elapsedMs / 1000) * factor) / factor;
    onChange(seconds);
    if (phase === 'running') {
      pauseTimer();
    }
  };

  const manualPath = '__duration_manual__';
  const manual = useNumericDraftInput({
    data: value,
    path: manualPath,
    handleChange: (_p, v) => onChange(v),
    schemaKind: 'number',
    enterKeyHint: keyboardEnterKeyHint,
    enabled,
  });

  if (mode === 'manual') {
    return (
      <Box>
        <TextField
          fullWidth
          label="Duration (seconds)"
          disabled={!enabled}
          error={hasError}
          value={manual.displayValue}
          onFocus={manual.onFocus}
          onBlur={manual.onBlur}
          onChange={manual.onChange}
          slotProps={{
            htmlInput: manual.inputProps,
          }}
        />
      </Box>
    );
  }

  const showTimer = mode === 'stopwatch' || isCountdown;
  const progress =
    isCountdown && countdownFrom! > 0
      ? Math.min(100, (displaySeconds / countdownFrom!) * 100)
      : undefined;

  const hasUnsavedTiming = elapsedMs > 0 && savedSeconds === undefined;
  const showSavedLine = savedSeconds !== undefined;

  return (
    <Stack spacing={2} alignItems="stretch">
      {showTimer && (
        <>
          <Typography
            variant="h3"
            component="div"
            sx={{
              fontFamily: 'monospace',
              fontWeight: 600,
              textAlign: 'center',
              letterSpacing: 2,
              py: 2,
              borderRadius: 1,
              bgcolor: 'action.hover',
              border: hasError ? '1px solid' : undefined,
              borderColor: hasError ? 'error.main' : undefined,
            }}>
            {formatDurationSeconds(displaySeconds, precision)}
          </Typography>

          {progress !== undefined && (
            <LinearProgress
              variant="determinate"
              value={100 - progress}
              sx={{ height: 8, borderRadius: 1 }}
            />
          )}

          {isCountdown && countdownFrom != null && (
            <Typography
              variant="caption"
              color="text.secondary"
              textAlign="center">
              Target: {formatDurationSeconds(countdownFrom, precision)}
            </Typography>
          )}

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {phase === 'idle' && (
              <Button
                variant="contained"
                disabled={!enabled}
                onClick={startTimer}>
                Start
              </Button>
            )}
            {phase === 'running' && (
              <Button
                variant="contained"
                disabled={!enabled}
                onClick={pauseTimer}>
                Pause
              </Button>
            )}
            {phase === 'paused' && (
              <Button
                variant="contained"
                disabled={!enabled}
                onClick={startTimer}>
                Resume
              </Button>
            )}
            <Button
              variant="outlined"
              disabled={!enabled || (phase === 'idle' && elapsedMs === 0)}
              onClick={resetTimer}>
              Reset
            </Button>
            {(phase === 'paused' || (phase === 'idle' && elapsedMs > 0)) && (
              <Button
                variant="contained"
                color="success"
                disabled={!enabled || elapsedMs === 0}
                onClick={saveTimer}>
                Save
              </Button>
            )}
          </Stack>

          {showSavedLine && (
            <Typography
              variant="body2"
              sx={{ color: tokens.color.semantic.success['600'] }}>
              Saved: {formatDurationSeconds(savedSeconds, precision)}
            </Typography>
          )}

          {phase !== 'idle' && hasUnsavedTiming && (
            <Typography variant="caption" color="text.secondary">
              Not saved yet — pause and tap Save to record this duration.
            </Typography>
          )}
        </>
      )}

      {allowManualEntry && (
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 0.5, display: 'block' }}>
            Or enter duration manually (seconds)
          </Typography>
          <TextField
            fullWidth
            size="small"
            disabled={!enabled}
            error={hasError}
            value={manual.displayValue}
            onFocus={manual.onFocus}
            onBlur={manual.onBlur}
            onChange={manual.onChange}
            slotProps={{
              htmlInput: manual.inputProps,
            }}
          />
        </Box>
      )}
    </Stack>
  );
}
