import { decodeFRMLS } from '../utils/FRMLSHelpers';
import { normalizeServerUrl } from './normalizeServerUrl';

function unwrapQRCode(qrString: string): string {
  // Preserve legacy FRMLS QR codes.
  if (qrString.startsWith('FRMLS:')) {
    return qrString;
  }

  // Accept formulus://settings and formulus://settings/
  // with a query string.
  const match = /^formulus:\/\/settings\/?\?([^#]*)$/i.exec(qrString);

  if (!match) {
    throw new Error('Not a Formulus settings link');
  }

  const query = match[1];
  const payloads: string[] = [];

  for (const parameter of query.split('&')) {
    const separator = parameter.indexOf('=');
    const rawKey = separator === -1 ? parameter : parameter.slice(0, separator);
    const rawValue = separator === -1 ? '' : parameter.slice(separator + 1);

    let key: string;
    let value: string;

    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      throw new Error('Malformed settings link encoding');
    }

    if (key === 'payload') {
      payloads.push(value);
    }
  }

  if (payloads.length !== 1 || !payloads[0]) {
    throw new Error('Missing or duplicate FRMLS payload');
  }

  return payloads[0];
}

export interface SettingsUpdate {
  serverUrl: string;
  username: string;
  password: string;
}

export class QRSettingsService {
  /**
   * Parses an already extracted FRMLS payload.
   */
  static parsePayload(payload: string): SettingsUpdate {
    try {
      const frmls = decodeFRMLS(payload);

      return {
        serverUrl: frmls.s,
        username: frmls.u,
        password: frmls.p,
      };
    } catch (error) {
      throw new Error(
        `Invalid QR code format: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Parses a complete QR code string and extracts settings.
   */
  static parseQRCode(qrString: string): SettingsUpdate {
    try {
      return this.parsePayload(unwrapQRCode(qrString));
    } catch (error) {
      throw new Error(
        `Invalid QR code format: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Parse and normalize an already extracted FRMLS payload.
   */
  static async processPayload(payload: string): Promise<SettingsUpdate> {
    const settings = this.parsePayload(payload);
    const normalized = normalizeServerUrl(settings.serverUrl);

    if (!normalized.ok) {
      throw new Error(normalized.message);
    }

    return { ...settings, serverUrl: normalized.href };
  }

  /**
   * Parse and normalize QR settings without persisting credentials. The caller
   * saves the server choice and login() stores credentials only after auth succeeds.
   */
  static async processQRCode(qrString: string): Promise<SettingsUpdate> {
    const settings = this.parseQRCode(qrString);
    const normalized = normalizeServerUrl(settings.serverUrl);

    if (!normalized.ok) {
      throw new Error(normalized.message);
    }

    return { ...settings, serverUrl: normalized.href };
  }
}
