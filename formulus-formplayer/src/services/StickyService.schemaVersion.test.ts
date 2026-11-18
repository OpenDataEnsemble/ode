// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { formplayerStorage } from './ProfileStorage';
import { stickyService } from './StickyService';
import { resolveFormSchemaVersion } from '../utils/formSchemaVersion';

beforeEach(() => {
  localStorage.clear();
  formplayerStorage.initialize({ __odeProfileId: 'sticky-test' }, localStorage);
});

it('isolates sticky values by resolved schema version for the same form', () => {
  const v2 = resolveFormSchemaVersion({ schemaVersion: '2', version: 'old' });
  const v3 = resolveFormSchemaVersion({ schemaVersion: '3', version: 'old' });
  stickyService.saveStickyValues('household', v2, { district: 'A' });
  expect(stickyService.getStickyValues('household', v3)).toEqual({});
  stickyService.saveStickyValues('household', v3, { district: 'B' });
  expect(stickyService.getStickyValues('household', v2)).toEqual({
    district: 'A',
  });
  expect(stickyService.getStickyValues('household', v3)).toEqual({
    district: 'B',
  });
});

it('uses the 1.0 bucket for versionless forms without migrating the legacy 0 bucket', () => {
  stickyService.saveStickyValues('household', undefined, {
    district: 'Legacy',
  });
  const version = resolveFormSchemaVersion({});
  expect(version).toBe('1.0');
  expect(stickyService.getStickyValues('household', version)).toEqual({});
  stickyService.saveStickyValues('household', version, { district: 'Current' });
  expect(stickyService.getStickyValues('household', '1.0')).toEqual({
    district: 'Current',
  });
  expect(stickyService.getStickyValues('household', undefined)).toEqual({
    district: 'Legacy',
  });
});
