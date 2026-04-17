/// <reference types="jest" />

import { describe, it, expect, jest } from '@jest/globals';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

import {
  classifyServerChange,
  resolvePreviousServerUrl,
} from '../ServerSwitchDecision';

describe('resolvePreviousServerUrl', () => {
  it('returns the persisted URL when present, regardless of component-state fallback', async () => {
    const getPersisted = jest.fn(async () => 'https://real.example/');
    const prev = await resolvePreviousServerUrl('', getPersisted);
    expect(prev).toBe('https://real.example/');
    expect(getPersisted).toHaveBeenCalledTimes(1);
  });

  it('falls back to component state when the persisted URL is null (fresh install)', async () => {
    const prev = await resolvePreviousServerUrl(
      'https://state.example/',
      async () => null,
    );
    expect(prev).toBe('https://state.example/');
  });

  it('falls back to component state when the persisted URL is an empty string', async () => {
    const prev = await resolvePreviousServerUrl(
      'https://state.example/',
      async () => '   ',
    );
    expect(prev).toBe('https://state.example/');
  });

  it('falls back to component state when getPersisted throws (defensive)', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const prev = await resolvePreviousServerUrl(
      'https://state.example/',
      async () => {
        throw new Error('storage unavailable');
      },
    );
    expect(prev).toBe('https://state.example/');
    warn.mockRestore();
  });

  it('regression: even when component state is empty (un-hydrated Settings screen), the persisted URL drives the decision', async () => {
    // Exactly the PR #601 regression: the Settings screen mounts before the
    // hydration cache has filled, `initialServerUrl` is `""`, but there IS a
    // real server URL persisted. The previous implementation fell through to
    // the "first-time setup" branch and silently wiped local data.
    const prev = await resolvePreviousServerUrl(
      '',
      async () => 'https://persisted.example/',
    );
    expect(prev).toBe('https://persisted.example/');
  });
});

describe('classifyServerChange', () => {
  it('returns "invalid" for malformed URLs', () => {
    const d = classifyServerChange('not a url', '');
    expect(d.kind).toBe('invalid');
  });

  it('returns "first-time" when no previous URL is known', () => {
    const d = classifyServerChange('https://example.org', '');
    expect(d.kind).toBe('first-time');
    if (d.kind === 'first-time') {
      expect(d.normalizedUrl).toMatch(/^https:\/\/example\.org/);
    }
  });

  it('returns "same" when the entered URL normalizes to the previous URL', () => {
    const d = classifyServerChange(
      'HTTPS://Example.org/',
      'https://example.org/',
    );
    expect(d.kind).toBe('same');
  });

  it('returns "switch" when entered URL is different from previous', () => {
    const d = classifyServerChange(
      'https://new.example.org/',
      'https://old.example.org/',
    );
    expect(d.kind).toBe('switch');
    if (d.kind === 'switch') {
      expect(d.normalizedUrl).toMatch(/new\.example\.org/);
      expect(d.previousUrl).toMatch(/old\.example\.org/);
    }
  });

  it('regression: an un-hydrated component state but a real persisted URL results in "switch", not "first-time"', () => {
    // This is the scenario the user hits: they navigate to Settings before
    // hydration completes, enter a new URL, and the classifier must see the
    // previous URL from `serverConfigService.getServerUrl()` and classify as
    // a switch so the wipe warning fires.
    const d = classifyServerChange(
      'https://new.example.org/',
      'https://persisted.example/',
    );
    expect(d.kind).toBe('switch');
  });
});
