import { decodeFRMLS } from '../utils/FRMLSHelpers';
import { normalizeServerUrl } from './normalizeServerUrl';

const FORMULUS_SETTINGS_URL = 'formulus://settings';

function unwrapQRCode(qrString: string): string {
  if (qrString.startsWith('FRMLS:')) return qrString;

  const prefix = `${FORMULUS_SETTINGS_URL}?payload=`;
  if (!qrString.startsWith(prefix)) {
    throw new Error('Not a Formulus settings link');
  }

  const encodedPayload = qrString.slice(prefix.length);
  if (!encodedPayload) {
    throw new Error('Missing FRMLS payload');
  }

  return decodeURIComponent(encodedPayload);
}
export interface SettingsUpdate {
  serverUrl: string;
  username: string;
  password: string;
}

export class QRSettingsService {
  /**
   * Parses a QR code string and extracts settings
   */
  static parseQRCode(qrString: string): SettingsUpdate {
    try {
      const frmls = decodeFRMLS(unwrapQRCode(qrString));

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
