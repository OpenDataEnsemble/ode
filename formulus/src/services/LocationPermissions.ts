import {Platform} from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  Permission,
} from 'react-native-permissions';

export interface LocationPermissionOptions {
  background?: boolean;
}

/**
 * Ensures location permission is granted for the current platform
 * @param options Configuration for permission type
 * @returns Promise resolving to permission status
 */
export async function ensureLocationPermission({
  background = false,
}: LocationPermissionOptions = {}): Promise<string> {
  const wanted: Permission = Platform.select({
    ios: background
      ? PERMISSIONS.IOS.LOCATION_ALWAYS
      : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
    android: background
      ? PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION
      : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
  })!;

  let status = await check(wanted);
  if (status === RESULTS.DENIED) {
    status = await request(wanted);
  }

  return status;
}

/**
 * Check if location permission is granted
 * @param options Configuration for permission type
 * @returns Promise resolving to boolean indicating if permission is granted
 */
export async function hasLocationPermission({
  background = false,
}: LocationPermissionOptions = {}): Promise<boolean> {
  const status = await ensureLocationPermission({background});
  return status === RESULTS.GRANTED;
}
