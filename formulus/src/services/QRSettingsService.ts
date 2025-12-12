import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import {decodeFRMLS, FRMLS} from '../utils/FRMLSHelpers';

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
      const frmls = decodeFRMLS(qrString);

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
   * Updates app settings with parsed QR data
   */
  static async updateSettings(settings: SettingsUpdate): Promise<void> {
    try {
      // Save server URL to AsyncStorage
      await AsyncStorage.setItem(
        '@settings',
        JSON.stringify({
          serverUrl: settings.serverUrl,
        }),
      );

      // Save credentials to Keychain
      await Keychain.setGenericPassword(settings.username, settings.password);

      console.log('Settings updated successfully from QR code');
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw new Error('Failed to save settings');
    }
  }

  /**
   * Complete QR code processing: parse and update settings
   */
  static async processQRCode(qrString: string): Promise<SettingsUpdate> {
    const settings = this.parseQRCode(qrString);
    await this.updateSettings(settings);
    return settings;
  }
}
