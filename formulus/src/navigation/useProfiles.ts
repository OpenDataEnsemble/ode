import { useEffect, useState } from 'react';
import { profileRegistry } from '../profiles/ProfileRegistry';
import { getActiveProfile } from '../profiles/ProfileRuntime';

const readProfiles = () => ({
  profiles: profileRegistry.list(),
  activeProfile: getActiveProfile(),
});

export function useProfiles() {
  const [snapshot, setSnapshot] = useState(readProfiles);

  useEffect(() => {
    const refresh = () => setSnapshot(readProfiles());
    const unsubscribe = profileRegistry.subscribe(refresh);
    refresh();
    return unsubscribe;
  }, []);

  return snapshot;
}
