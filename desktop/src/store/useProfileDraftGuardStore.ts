import { create } from 'zustand';

type ProfileDraftGuardState = {
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  attemptLeave: (() => Promise<boolean>) | null;
  setAttemptLeave: (fn: (() => Promise<boolean>) | null) => void;
};

export const useProfileDraftGuardStore = create<ProfileDraftGuardState>(
  set => ({
    isDirty: false,
    setIsDirty: dirty => set({ isDirty: dirty }),
    attemptLeave: null,
    setAttemptLeave: fn => set({ attemptLeave: fn }),
  }),
);

/** Returns true when navigation should proceed. */
export async function guardedProfileNavigation(
  navigate: (to: string) => void,
  to: string,
  fromPathname: string,
): Promise<void> {
  const { isDirty, attemptLeave } = useProfileDraftGuardStore.getState();
  if (
    fromPathname !== '/data/profiles' ||
    to === '/data/profiles' ||
    !isDirty ||
    !attemptLeave
  ) {
    navigate(to);
    return;
  }
  const proceed = await attemptLeave();
  if (proceed) {
    navigate(to);
  }
}
