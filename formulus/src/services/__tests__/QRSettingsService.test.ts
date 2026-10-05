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
    ).toThrow('Missing FRMLS payload');
  });
});
