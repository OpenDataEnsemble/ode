import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveProfile } from '../profiles/ProfileRuntime';

const NAVIGATION_INTENT_KEY = '@ode/profiles/navigationIntent';
let remountIntent = false;
let remountEpoch = 0;

/** A warm switch can remount before the caller's persisted-intent follow-up. */
export function markProfilesNavigationRemount(): void {
  remountIntent = true;
  remountEpoch += 1;
}

/** Remember the destination for the cold launch; never reload or navigate here. */
export async function transitionToProfiles(
  transition: () => Promise<void>,
  targetProfileId?: string,
): Promise<void> {
  const intent = { fromProfileId: getActiveProfile().id, targetProfileId };
  const initialEpoch = remountEpoch;
  await AsyncStorage.setItem(NAVIGATION_INTENT_KEY, JSON.stringify(intent));
  try {
    await transition();
  } catch (error) {
    // A failed transition keeps the old active ID, so even if removal fails the
    // intent cannot redirect that profile on the next launch.
    await AsyncStorage.removeItem(NAVIGATION_INTENT_KEY).catch(() => {});
    throw error;
  }
  if (remountEpoch !== initialEpoch) {
    await AsyncStorage.removeItem(NAVIGATION_INTENT_KEY).catch(() => {});
    return;
  }
  // Inactive deletion keeps the same selected ID. Mark only after commit so
  // rejected transitions cannot redirect it. Failure here must not turn a
  // durable profile commit into a misleading “try again” error.
  await AsyncStorage.setItem(
    NAVIGATION_INTENT_KEY,
    JSON.stringify({ ...intent, committed: true }),
  ).catch(() => {});
}

export async function consumeProfilesNavigationIntent(): Promise<boolean> {
  if (remountIntent) {
    remountIntent = false;
    await AsyncStorage.removeItem(NAVIGATION_INTENT_KEY).catch(() => {});
    return true;
  }
  try {
    const stored = await AsyncStorage.getItem(NAVIGATION_INTENT_KEY);
    if (!stored) return false;
    await AsyncStorage.removeItem(NAVIGATION_INTENT_KEY);
    const intent: unknown = JSON.parse(stored);
    if (!intent || typeof intent !== 'object' || !('fromProfileId' in intent))
      return false;
    const activeId = getActiveProfile().id;
    if (
      typeof intent.fromProfileId !== 'string' ||
      (activeId === intent.fromProfileId &&
        (!('committed' in intent) || intent.committed !== true))
    )
      return false;
    return (
      !('targetProfileId' in intent) || intent.targetProfileId === activeId
    );
  } catch {
    return false;
  }
}
