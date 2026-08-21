function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * Local date-time for dense tables. Avoid Date#toLocaleString — on Hermes
 * the first ICU locale load can stall the JS thread for 1–2s.
 */
export function formatDateTimeShort(date: Date | string | null): string {
  if (!date) {
    return '—';
  }
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(dateObj.getTime())) {
    return '—';
  }
  return `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(
    dateObj.getDate(),
  )} ${pad2(dateObj.getHours())}:${pad2(dateObj.getMinutes())}`;
}

export const formatRelativeTime = (date: Date | string | null): string => {
  if (!date) {
    return 'Never';
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) {
    return 'Never';
  }

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  if (diffMs < 0) {
    return dateObj.toLocaleDateString();
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  }
  if (diffYears >= 1) {
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return dateObj.toLocaleDateString();
};
