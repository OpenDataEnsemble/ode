// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-20T12:00:00.000Z');
const scoped = (key: string) => `ode:profile-a:formplayer:${key}`;

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.resetModules();
});

async function draftService() {
  const { formplayerStorage } = await import('./ProfileStorage');
  formplayerStorage.initialize({ __odeProfileId: 'profile-a' }, localStorage);
  return (await import('./DraftService')).draftService;
}

function legacyBlob(rows: Array<{ id: string; updatedAt: string }>) {
  localStorage.setItem(
    scoped('formulus_drafts'),
    JSON.stringify(
      rows.map(row => ({
        id: row.id,
        formType: 'household',
        data: { name: row.id },
        createdAt: row.updatedAt,
        updatedAt: row.updatedAt,
        observationId: null,
        draftSessionKey: `session-${row.id}`,
      })),
    ),
  );
}

const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * DAY).toISOString();

it('migrates the single drafts blob into one entry per draft', async () => {
  legacyBlob([
    { id: 'a', updatedAt: daysAgo(1) },
    { id: 'b', updatedAt: daysAgo(2) },
  ]);
  const drafts = await draftService();
  expect(drafts.getTotalDraftCount()).toBe(2);
  expect(localStorage.getItem(scoped('formulus_drafts'))).toBeNull();
  expect(localStorage.getItem(scoped('draft_v2:a'))).toContain('"name":"a"');
  expect(drafts.getDraft('b')?.data).toEqual({ name: 'b' });
});

it('rolls a failed migration back so it can retry later', async () => {
  legacyBlob([{ id: 'a', updatedAt: daysAgo(1) }]);
  const drafts = await draftService();
  const setItem = Storage.prototype.setItem;
  const spy = vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(function (this: Storage, key, value) {
      if (key === scoped('drafts_index_v2')) throw new Error('quota');
      setItem.call(this, key, value);
    });
  expect(() => drafts.getTotalDraftCount()).toThrow('quota');
  expect(localStorage.getItem(scoped('formulus_drafts'))).toContain('"a"');
  expect(localStorage.getItem(scoped('draft_v2:a'))).toBeNull();
  spy.mockRestore();
  expect(drafts.getTotalDraftCount()).toBe(1);
});

it('removes drafts not edited within the max age, keeping recent ones', async () => {
  legacyBlob([
    { id: 'fresh', updatedAt: daysAgo(6) },
    { id: 'stale', updatedAt: daysAgo(8) },
  ]);
  const drafts = await draftService();
  expect(drafts.cleanupExpiredDrafts({ now: NOW })).toBe(1);
  expect(drafts.getDraft('fresh')).not.toBeNull();
  expect(drafts.getDraft('stale')).toBeNull();
  expect(localStorage.getItem(scoped('draft_v2:stale'))).toBeNull();
});

it('keeps drafts with future or invalid dates and drafts selected by keep', async () => {
  legacyBlob([
    { id: 'future', updatedAt: new Date(NOW.getTime() + DAY).toISOString() },
    { id: 'corrupt', updatedAt: 'not a date' },
    { id: 'opening', updatedAt: daysAgo(30) },
  ]);
  const drafts = await draftService();
  expect(
    drafts.cleanupExpiredDrafts({
      now: NOW,
      keep: draft => draft.id === 'opening',
    }),
  ).toBe(0);
  expect(drafts.getTotalDraftCount()).toBe(3);
});

it('honours a custom max age and treats non-positive values as disabled', async () => {
  legacyBlob([{ id: 'a', updatedAt: daysAgo(3) }]);
  const drafts = await draftService();
  expect(drafts.cleanupExpiredDrafts({ now: NOW, maxAgeDays: 0 })).toBe(0);
  expect(drafts.cleanupExpiredDrafts({ now: NOW, maxAgeDays: 2 })).toBe(1);
});

it('reports when each draft expires, counted from its last edit', async () => {
  const drafts = await draftService();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  drafts.saveDraft('household', { name: 'x' }, undefined, 'session-x');
  vi.useRealTimers();
  const [summary] = drafts.getDraftsForForm('household');
  expect(summary.expiresAt.getTime()).toBe(NOW.getTime() + 7 * DAY);
});

it('a draft that cannot be stored does not affect other drafts', async () => {
  const drafts = await draftService();
  drafts.saveDraft('household', { name: 'small' }, undefined, 'small');
  const setItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key,
    value,
  ) {
    if (String(value).includes('huge')) throw new Error('quota');
    setItem.call(this, key, value);
  });
  expect(() =>
    drafts.saveDraft('household', { name: 'huge' }, undefined, 'big'),
  ).toThrow('quota');
  vi.restoreAllMocks();
  expect(drafts.getTotalDraftCount()).toBe(1);
  expect(drafts.getDraftsForForm('household')[0].dataPreview).toContain(
    'small',
  );
});
