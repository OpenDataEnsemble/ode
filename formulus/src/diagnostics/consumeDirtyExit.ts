import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  dirtyExitFromAei,
  dirtyExitFromHeartbeat,
  isDirtyExit,
  isDirtyHeartbeat,
} from './classifyExit';
import { readLastExit } from './DiagnosticLog';
import { getRecentNativeExits } from './nativeExits';
import { beginSession } from './sessionHeartbeat';
import type { DirtyExit, ProcessExitRecord } from './types';

export const SHOWN_EXIT_KEY = '@diagnostics_shown_exit_at';

async function alreadyShown(timestamp: string): Promise<boolean> {
  const shown = await AsyncStorage.getItem(SHOWN_EXIT_KEY);
  return shown === timestamp;
}

async function markShown(timestamp: string): Promise<void> {
  await AsyncStorage.setItem(SHOWN_EXIT_KEY, timestamp);
}

function pickLastExit(
  fromFile: ProcessExitRecord | null,
  fromNative: ProcessExitRecord[],
): ProcessExitRecord | null {
  if (fromFile) {
    return fromFile;
  }
  return fromNative.length > 0 ? fromNative[fromNative.length - 1] : null;
}

/**
 * Starts a new heartbeat session and returns a dirty exit to show once.
 */
export async function consumePendingDirtyExit(): Promise<DirtyExit | null> {
  const previousSession = await beginSession();
  const [fromFile, fromNative] = await Promise.all([
    readLastExit(),
    getRecentNativeExits(5),
  ]);
  const lastExit = pickLastExit(fromFile, fromNative);

  if (lastExit) {
    if (!isDirtyExit(lastExit)) {
      return null;
    }
    const dirty = dirtyExitFromAei(lastExit);
    if (await alreadyShown(dirty.timestamp)) {
      return null;
    }
    await markShown(dirty.timestamp);
    return dirty;
  }

  if (isDirtyHeartbeat(previousSession) && previousSession) {
    const dirty = dirtyExitFromHeartbeat(previousSession);
    if (await alreadyShown(dirty.timestamp)) {
      return null;
    }
    await markShown(dirty.timestamp);
    return dirty;
  }

  return null;
}
