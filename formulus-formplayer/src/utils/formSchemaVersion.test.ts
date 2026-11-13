import { expect, it } from 'vitest';
import { resolveFormSchemaVersion } from './formSchemaVersion';

it.each([
  [{ schemaVersion: '2' }, '2'],
  [{ version: '3' }, '3'],
  [{ schemaVersion: '2', version: '3' }, '2'],
  [{}, '1.0'],
  [undefined, '1.0'],
  [null, '1.0'],
  [false, '1.0'],
  [{ schemaVersion: '', version: '3' }, '3'],
  [{ schemaVersion: ' \t\n', version: '3' }, '3'],
  ...[null, 2, false, {}, []].map(schemaVersion => [
    { schemaVersion, version: '3' },
    '3',
  ]),
  ...['', ' \t\n', null, 2, false, {}, []].map(version => [{ version }, '1.0']),
  [{ schemaVersion: ' ', version: 2 }, '1.0'],
  [{ schemaVersion: ' 2 ' }, ' 2 '],
  [{ version: ' 3 ' }, ' 3 '],
  [{ properties: { schemaVersion: '2', version: '3' } }, '1.0'],
])('resolves root metadata %j to %s', (schema, expected) => {
  expect(resolveFormSchemaVersion(schema)).toBe(expected);
});
