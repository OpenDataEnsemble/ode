export class ProfileUIError extends Error {
  constructor(readonly translationKey: string) {
    super(translationKey);
    this.name = 'ProfileUIError';
  }
}

// Native, network and transition errors may contain URLs or credentials.
// Only errors authored by this UI are safe to turn into localized messages.
export function profileErrorKey(error: unknown, fallbackKey: string): string {
  return error instanceof ProfileUIError ? error.translationKey : fallbackKey;
}
