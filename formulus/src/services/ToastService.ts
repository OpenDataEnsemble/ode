import {ToastAndroid, Platform, Alert} from 'react-native';

/**
 * Cross-platform toast notification service
 * Uses ToastAndroid on Android and Alert on iOS
 */
export class ToastService {
  /**
   * Show a short toast message
   */
  public static showShort(message: string): void {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      // iOS fallback - could be replaced with a third-party toast library
      Alert.alert('Info', message);
    }
  }

  /**
   * Show a long toast message
   */
  public static showLong(message: string): void {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.LONG);
    } else {
      // iOS fallback
      Alert.alert('Info', message);
    }
  }

  /**
   * Show a toast specifically for geolocation unavailable
   */
  public static showGeolocationUnavailable(): void {
    this.showShort(
      'Location unavailable - observation saved without geolocation',
    );
  }

  /**
   * Show a toast for successful geolocation capture
   */
  public static showGeolocationCaptured(): void {
    this.showShort('Location captured with observation');
  }
}
