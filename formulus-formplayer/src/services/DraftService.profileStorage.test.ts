// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.resetModules();
});

async function services(id: string) {
  vi.resetModules();
  const { formplayerStorage } = await import('./ProfileStorage');
  formplayerStorage.initialize({ __odeProfileId: id }, localStorage);
  return {
    draft: (await import('./DraftService')).draftService,
    sticky: (await import('./StickyService')).stickyService,
  };
}

it('draft lookup and sticky defaults are isolated even for identical form IDs', async () => {
  const a = await services('profile-a');
  a.draft.saveDraft('household', { name: 'Alice' }, undefined, 'session-a');
  a.sticky.saveStickyValues('household', '1', { district: 'A' });
  const b = await services('profile-b');
  expect(b.draft.getDraftsForForm('household')).toEqual([]);
  expect(b.sticky.getStickyValues('household', '1')).toEqual({});
  b.draft.saveDraft('household', { name: 'Bob' }, undefined, 'session-b');
  b.draft.clearAllDrafts();
  expect(a.draft.getDraftsForForm('household')).toHaveLength(1);
  expect(a.sticky.getStickyValues('household', '1')).toEqual({ district: 'A' });
});

it('preserves inactive drafts on lookup and save, including other forms and migrated legacy drafts', async () => {
  const oldDate = '2001-01-01T00:00:00.000Z';
  const oldDrafts = ['household', 'other-form'].map((formType, index) => ({
    id: `old-${index}`,
    formType,
    data: { name: 'Unfinished' },
    createdAt: oldDate,
    updatedAt: oldDate,
    observationId: null,
  }));
  localStorage.setItem('formulus_drafts', JSON.stringify(oldDrafts));
  const { formplayerStorage } = await import('./ProfileStorage');
  formplayerStorage.initialize(
    {
      __odeProfileId: 'legacy-owner',
      __odeLegacyWebStorageProfileId: 'legacy-owner',
    },
    localStorage,
  );
  const { draftService: draft } = await import('./DraftService');
  expect(draft.getDraftsForForm('household')).toHaveLength(1);
  expect(draft.getDraft('old-0')?.data).toEqual({ name: 'Unfinished' });
  draft.saveDraft('household', { name: 'New' }, undefined, 'new-session');
  expect(draft.getDraftsForForm('household')).toHaveLength(2);
  expect(draft.getDraftsForForm('other-form')).toHaveLength(1);
  expect(draft.getTotalDraftCount()).toBe(3);
  expect(draft.deleteDraft('old-0')).toBe(true);
  expect(draft.getDraft('old-0')).toBeNull();
  expect(draft.getDraft('old-1')).not.toBeNull();
  expect(draft.getTotalDraftCount()).toBe(2);
});

it('does not report a saved draft when storage rejects the write or read', async () => {
  const { draft } = await services('profile-a');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  expect(() =>
    draft.saveDraft('household', {}, undefined, 'session-a'),
  ).toThrow('quota');
  vi.restoreAllMocks();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(() =>
    draft.saveDraft('household', {}, undefined, 'session-a'),
  ).toThrow('blocked');
});

it.each([
  [{ schemaVersion: '2' }, '2'],
  [{ version: '3' }, '3'],
  [{}, '1.0'],
  [{ schemaVersion: '2', version: '3' }, '2'],
])(
  'stores resolved version for a new draft with schema %j',
  async (formSchema, expected) => {
    const { draft } = await services('profile-a');
    const id = draft.saveDraft(
      'household',
      {},
      {
        formType: 'household',
        observationId: null,
        params: {},
        savedData: {},
        formSchema,
      },
      'session-a',
    );
    expect(draft.getDraft(id)?.formVersion).toBe(expected);
  },
);

it('keeps legacy unversioned drafts discoverable without relabeling on update', async () => {
  const { draft } = await services('profile-a');
  const { formplayerStorage } = await import('./ProfileStorage');
  const now = new Date().toISOString();
  formplayerStorage.setItem(
    'formulus_drafts',
    JSON.stringify([
      {
        id: 'legacy',
        formType: 'household',
        data: {},
        createdAt: now,
        updatedAt: now,
        observationId: null,
        draftSessionKey: 'legacy-session',
      },
    ]),
  );
  const init = (schemaVersion: string) => ({
    formType: 'household',
    observationId: null,
    params: {},
    savedData: {},
    formSchema: { schemaVersion },
  });
  // Draft IDs use Date.now(); keep the two new drafts distinct deterministically.
  vi.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(101);
  const matching = draft.saveDraft('household', {}, init('2'), 'matching');
  const mismatched = draft.saveDraft('household', {}, init('3'), 'mismatched');
  expect(
    draft
      .getDraftsForForm('household', '2')
      .map(item => item.id)
      .sort(),
  ).toEqual(['legacy', matching].sort());
  expect(
    draft.getDraftsForForm('household', '2').map(item => item.id),
  ).not.toContain(mismatched);
  draft.saveDraft(
    'household',
    { name: 'Resumed' },
    init('2'),
    'legacy-session',
  );
  expect(draft.getDraft('legacy')?.formVersion).toBeUndefined();
  expect(draft.getDraft('legacy')?.data).toEqual({ name: 'Resumed' });
  expect(
    draft.getDraftsForForm('household', '2').map(item => item.id),
  ).toContain('legacy');
});
