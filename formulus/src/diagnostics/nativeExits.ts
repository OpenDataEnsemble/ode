import { NativeModules, Platform } from 'react-native';
import type { ProcessExitRecord } from './types';

type DiagnosticsNative = {
  getRecentExits: (max: number) => Promise<ProcessExitRecord[]>;
};

export async function getRecentNativeExits(
  max: number = 5,
): Promise<ProcessExitRecord[]> {
  if (Platform.OS !== 'android') {
    return [];
  }
  const mod = NativeModules.DiagnosticsModule as DiagnosticsNative | undefined;
  if (!mod?.getRecentExits) {
    return [];
  }
  try {
    return await mod.getRecentExits(max);
  } catch {
    return [];
  }
}
