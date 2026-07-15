import { describe, expect, it } from 'vitest';
import { pushConfirmMessage } from './syncUiCopy';

describe('pushConfirmMessage', () => {
  it('includes the observation count and profile label', () => {
    expect(pushConfirmMessage(12, 'AnthroCollect field')).toBe(
      'Push 12 observations to AnthroCollect field?',
    );
  });

  it('uses singular observation for one row', () => {
    expect(pushConfirmMessage(1, 'Local dev')).toBe(
      'Push 1 observation to Local dev?',
    );
  });

  it('falls back when the profile label is empty', () => {
    expect(pushConfirmMessage(3, '   ')).toBe(
      'Push 3 observations to this profile?',
    );
  });
});
