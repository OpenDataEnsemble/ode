import { open } from '@tauri-apps/plugin-dialog';
import { useCallback } from 'react';
import {
  selectActiveProfileState,
  useCustodianStore,
} from '../store/useCustodianStore';

/**
 * Shared Workbench developer mode: profile settings, mirror refresh, and generation counter.
 */
export function useDeveloperMode() {
  const activeProfile = useCustodianStore(selectActiveProfileState);
  const upsertProfileRemote = useCustodianStore(s => s.upsertProfileRemote);
  const devMirrorGeneration = useCustodianStore(s => s.devMirrorGeneration);
  const devBusy = useCustodianStore(s => s.devBusy);
  const devError = useCustodianStore(s => s.devError);
  const refreshDevMirror = useCustodianStore(s => s.refreshDevMirror);
  const setDevError = useCustodianStore(s => s.setDevError);

  const developerMode = Boolean(activeProfile?.customAppDeveloperMode);
  const localFolder = (activeProfile?.customAppLocalFolder ?? '').trim();

  const persistProfilePatch = useCallback(
    async (
      patch: Partial<{
        customAppDeveloperMode: boolean | null;
        customAppLocalFolder: string | null;
      }>,
    ) => {
      if (!activeProfile) {
        return;
      }
      await upsertProfileRemote({ ...activeProfile, ...patch });
    },
    [activeProfile, upsertProfileRemote],
  );

  const setDeveloperMode = useCallback(
    async (enabled: boolean) => {
      if (!activeProfile || developerMode === enabled) {
        return;
      }
      await persistProfilePatch({ customAppDeveloperMode: enabled });
      if (!enabled) {
        setDevError(null);
      }
    },
    [activeProfile, developerMode, persistProfilePatch, setDevError],
  );

  const pickLocalFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select local custom app folder',
    });
    if (selected == null || Array.isArray(selected)) {
      return;
    }
    await persistProfilePatch({
      customAppLocalFolder: selected,
      customAppDeveloperMode: true,
    });
  }, [persistProfilePatch]);

  const refreshDevApp = useCallback(async () => {
    return refreshDevMirror();
  }, [refreshDevMirror]);

  return {
    activeProfile,
    developerMode,
    localFolder,
    devMirrorGeneration,
    devBusy,
    devError,
    setDeveloperMode,
    pickLocalFolder,
    refreshDevApp,
  };
}
