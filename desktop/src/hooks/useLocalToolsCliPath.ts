import { useEffect, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { tauriClient } from '../lib/tauriClient';

/** Path to the bundled `ode` CLI, or null outside Tauri / when it is not shipped. */
export function useLocalToolsCliPath(): string | null {
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    let cancelled = false;
    tauriClient
      .getLocalToolsCliPath()
      .then(p => {
        if (!cancelled) {
          setPath(p ?? null);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return path;
}
