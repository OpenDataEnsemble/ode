/** Format seconds for display (MM:SS.s or HH:MM:SS.s). */
export function formatDurationSeconds(
  totalSeconds: number,
  precision = 1,
): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '00:00.0';
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const secFixed = seconds.toFixed(precision);
  const secParts = secFixed.split('.');
  const secWhole = secParts[0].padStart(2, '0');
  const secFrac =
    precision > 0 ? `.${secParts[1] ?? '0'.repeat(precision)}` : '';

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${secWhole}${secFrac}`;
  }
  return `${String(minutes).padStart(2, '0')}:${secWhole}${secFrac}`;
}

/** Human-readable duration for finalize / review. */
export function formatDurationHuman(totalSeconds: number): string {
  if (
    totalSeconds === undefined ||
    totalSeconds === null ||
    Number.isNaN(totalSeconds)
  ) {
    return 'Not provided';
  }
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins === 0) {
    return `${secs.toFixed(1)} sec`;
  }
  if (secs < 0.05) {
    return `${mins} min`;
  }
  return `${mins} min ${secs.toFixed(1)} sec`;
}

export type DurationMode = 'stopwatch' | 'countdown' | 'manual';

export interface DurationConfig {
  mode?: DurationMode;
  unit?: 'seconds';
  precision?: number;
  allowManualEntry?: boolean;
  countdownFrom?: number | null;
}

/** JSON Schema field with optional duration extension (formplayer built-in). */
export type DurationJsonSchema = import('@jsonforms/core').JsonSchema7 & {
  duration?: DurationConfig;
};

export function parseDurationConfig(
  schema: Record<string, unknown>,
): DurationConfig {
  const raw = schema.duration;
  if (!raw || typeof raw !== 'object') return {};
  return raw as DurationConfig;
}
