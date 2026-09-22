export class ProfileBusyError extends Error {
  constructor() {
    super('Close open forms and wait for profile operations to finish before switching.');
    this.name = 'ProfileBusyError';
  }
}

/** A transition starts only from idle; it never interrupts a partially saved operation. */
export class ProfileActivity {
  private operations = new Set<symbol>();
  private blockers = new Set<string>();
  private transitioning = false;

  assertAvailable(): void {
    if (this.transitioning) throw new ProfileBusyError();
  }

  async run<T>(label: string, work: () => Promise<T>): Promise<T> {
    this.assertAvailable();
    const token = Symbol(label);
    this.operations.add(token);
    try {
      return await work();
    } finally {
      this.operations.delete(token);
    }
  }

  setBlocker(name: string, blocked: boolean): void {
    if (blocked) this.blockers.add(name);
    else this.blockers.delete(name);
  }

  isBusy(): boolean {
    return this.transitioning || this.operations.size > 0 || this.blockers.size > 0;
  }

  beginTransition(): void {
    // Check and lock synchronously, before any await can admit another operation.
    if (this.isBusy()) throw new ProfileBusyError();
    this.transitioning = true;
  }

  cancelTransition(): void {
    this.transitioning = false;
  }
}

export const profileActivity = new ProfileActivity();
