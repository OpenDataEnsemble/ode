import { pullPageOutcome } from '../pullCursor';

describe('pullPageOutcome', () => {
  it('finishes on the last page using current_version', () => {
    expect(
      pullPageOutcome(
        { current_version: 420, change_cutoff: 410, has_more: false },
        300,
      ),
    ).toEqual({ kind: 'done', version: 420 });
  });

  it('treats a missing has_more as the last page', () => {
    expect(
      pullPageOutcome({ current_version: 7, change_cutoff: 7 }, 0),
    ).toEqual({ kind: 'done', version: 7 });
  });

  it('continues from change_cutoff while more pages follow', () => {
    expect(
      pullPageOutcome(
        { current_version: 900, change_cutoff: 500, has_more: true },
        300,
      ),
    ).toEqual({ kind: 'continue', nextSince: 500 });
  });

  it('accepts a first page starting from version 0', () => {
    expect(
      pullPageOutcome(
        { current_version: 900, change_cutoff: 100, has_more: true },
        0,
      ),
    ).toEqual({ kind: 'continue', nextSince: 100 });
  });

  it('refuses to loop when change_cutoff does not advance past since', () => {
    const outcome = pullPageOutcome(
      { current_version: 900, change_cutoff: 300, has_more: true },
      300,
    );
    expect(outcome.kind).toBe('unusable');
    expect(outcome).toMatchObject({
      reason: expect.stringContaining('does not advance past since'),
    });
  });

  it('refuses to loop when change_cutoff moves backwards', () => {
    expect(
      pullPageOutcome(
        { current_version: 900, change_cutoff: 120, has_more: true },
        300,
      ).kind,
    ).toBe('unusable');
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['negative', -1],
    ['not finite', Number.NaN],
  ])('rejects a %s change_cutoff when more pages follow', (_label, cutoff) => {
    expect(
      pullPageOutcome(
        {
          current_version: 900,
          change_cutoff: cutoff as number | null | undefined,
          has_more: true,
        },
        10,
      ).kind,
    ).toBe('unusable');
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['negative', -5],
    ['not finite', Number.NaN],
  ])(
    'rejects a %s current_version on the final page',
    (_label, currentVersion) => {
      expect(
        pullPageOutcome(
          {
            current_version: currentVersion as number | null | undefined,
            change_cutoff: 10,
            has_more: false,
          },
          10,
        ).kind,
      ).toBe('unusable');
    },
  );

  it('allows a repository that is still empty to finish at version 0', () => {
    expect(
      pullPageOutcome(
        { current_version: 0, change_cutoff: 0, has_more: false },
        0,
      ),
    ).toEqual({ kind: 'done', version: 0 });
  });
});
