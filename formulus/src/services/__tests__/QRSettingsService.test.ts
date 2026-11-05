/// <reference types="jest" />

import { describe, it, expect } from '@jest/globals';
import { encodeFRMLS } from '../../utils/FRMLSHelpers';
import { QRSettingsService } from '../QRSettingsService';

describe('QRSettingsService', () => {
  it('parses a bare FRMLS payload', () => {
    const qr = encodeFRMLS({
      v: 1,
      s: 'https://example.org/',
      u: 'allen',
      p: 'secret',
    });

    const settings = QRSettingsService.parseQRCode(qr);

    expect(settings).toEqual({
      serverUrl: 'https://example.org/',
      username: 'allen',
      password: 'secret',
    });
  });
  it('parses an FRMLS payload wrapped in a Formulus settings deep link', () => {
    const frmls = encodeFRMLS({
      v: 1,
      s: 'https://example.org/',
      u: 'allen',
      p: 'secret',
    });
    const qr = `formulus://settings?payload=${encodeURIComponent(frmls)}`;

    const settings = QRSettingsService.parseQRCode(qr);

    expect(settings).toEqual({
      serverUrl: 'https://example.org/',
      username: 'allen',
      password: 'secret',
    });
  });
  it('rejects a non-Formulus deep link', () => {
    const frmls = encodeFRMLS({
      v: 1,
      s: 'https://example.org/',
      u: 'allen',
      p: 'secret',
    });
    const qr = `https://example.org/settings?payload=${encodeURIComponent(frmls)}`;

    expect(() => QRSettingsService.parseQRCode(qr)).toThrow(
      'Not a Formulus settings link',
    );
  });
  it('rejects a Formulus settings deep link with no payload', () => {
    expect(() =>
      QRSettingsService.parseQRCode('formulus://settings?payload='),
    ).toThrow('Missing or duplicate FRMLS payload');
  });

  it('parses a settings link with a trailing slash', () => {
  const frmls = encodeFRMLS({
    v: 1,
    s: 'https://example.org/',
    u: 'allen',
    p: 'secret',
  });

  const qr = `formulus://settings/?payload=${encodeURIComponent(frmls)}`;

  expect(QRSettingsService.parseQRCode(qr)).toEqual({
    serverUrl: 'https://example.org/',
    username: 'allen',
    password: 'secret',
  });
});

it('parses a settings link with additional query parameters', () => {
  const frmls = encodeFRMLS({
    v: 1,
    s: 'https://example.org/',
    u: 'allen',
    p: 'secret',
  });

  const qr =
    `formulus://settings?source=qr&payload=${encodeURIComponent(frmls)}` +
    '&version=1';

  expect(QRSettingsService.parseQRCode(qr)).toEqual({
    serverUrl: 'https://example.org/',
    username: 'allen',
    password: 'secret',
  });
});

it('rejects duplicate payload parameters', () => {
  expect(() =>
    QRSettingsService.parseQRCode(
      'formulus://settings?payload=first&payload=second',
    ),
  ).toThrow('Missing or duplicate FRMLS payload');
});

it('rejects malformed percent-encoding', () => {
  expect(() =>
    QRSettingsService.parseQRCode(
      'formulus://settings?payload=%ZZ',
    ),
  ).toThrow('Malformed settings link encoding');
});

it('rejects a settings link with an unexpected path', () => {
  expect(() =>
    QRSettingsService.parseQRCode(
      'formulus://settings/other?payload=test',
    ),
  ).toThrow('Not a Formulus settings link');
});

it('parses an extracted payload directly', () => {
  const frmls = encodeFRMLS({
    v: 1,
    s: 'https://example.org/',
    u: 'allen',
    p: 'secret',
  });

  expect(QRSettingsService.parsePayload(frmls)).toEqual({
    serverUrl: 'https://example.org/',
    username: 'allen',
    password: 'secret',
  });
  });
});
