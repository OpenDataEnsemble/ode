export type ProfileDraftBaseline = {
  profileId: string;
  label: string;
  serverUrl: string;
  username: string;
  password: string;
};

export type ProfileDraftFields = {
  label: string;
  serverUrl: string;
  username: string;
  password: string;
};

export function baselineFromProfile(
  p: {
    id: string;
    label: string;
    serverUrl?: string | null;
    username?: string | null;
  },
  password: string,
): ProfileDraftBaseline {
  return {
    profileId: p.id,
    label: (p.label ?? '').trim(),
    serverUrl: (p.serverUrl ?? '').trim(),
    username: (p.username ?? '').trim(),
    password,
  };
}

export function isProfileDraftDirty(
  baseline: ProfileDraftBaseline | null,
  profileId: string | undefined,
  draft: ProfileDraftFields,
): boolean {
  if (!profileId || !baseline || baseline.profileId !== profileId) {
    return false;
  }
  return (
    draft.label.trim() !== baseline.label ||
    draft.serverUrl.trim() !== baseline.serverUrl ||
    draft.username.trim() !== baseline.username ||
    draft.password !== baseline.password
  );
}
