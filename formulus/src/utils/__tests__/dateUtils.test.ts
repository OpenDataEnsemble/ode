import { formatDateTimeShort } from '../dateUtils';

describe('formatDateTimeShort', () => {
  test('formats a valid local date without locale APIs', () => {
    const date = new Date(2024, 5, 3, 9, 7);
    expect(formatDateTimeShort(date)).toBe('2024-06-03 09:07');
  });

  test('returns an em dash for invalid input', () => {
    expect(formatDateTimeShort(null)).toBe('—');
    expect(formatDateTimeShort('not-a-date')).toBe('—');
  });
});
