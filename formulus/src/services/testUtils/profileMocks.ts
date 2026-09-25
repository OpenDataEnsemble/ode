/** Contract doubles; profile lifecycle/storage implementation belongs to the profile core. */
export function createProfileActivityMock() {
  let unavailable = false;
  const jobs = new Map<symbol, string>();
  const assertAvailable = () => {
    if (unavailable) throw new Error('Profile transition in progress');
  };
  return {
    assertAvailable,
    isBusy: () => jobs.size > 0,
    activeLabels: () => [...jobs.values()],
    block() {
      if (jobs.size) throw new Error('Wait for profile jobs to finish');
      unavailable = true;
    },
    unblock() {
      unavailable = false;
    },
    async run<T>(label: string, work: () => Promise<T>): Promise<T> {
      assertAvailable();
      const id = Symbol(label);
      jobs.set(id, label);
      try {
        return await work();
      } finally {
        jobs.delete(id);
      }
    },
  };
}

export function createProfilePathsMock(root: string, cache = `${root}/cache`) {
  const join = (base: string, relative: string) => {
    if (
      relative.startsWith('/') ||
      relative.includes('..') ||
      relative.includes('\\')
    ) {
      throw new Error('Invalid profile-relative path');
    }
    return `${base}/${relative}`;
  };
  return {
    profilePaths: {
      root: () => root,
      attachments: () => `${root}/attachments`,
      app: () => `${root}/app`,
      forms: () => `${root}/forms`,
      signatures: () => `${root}/signatures`,
      cache: () => cache,
    },
    profilePath: (relative: string) => join(root, relative),
    profileCachePath: (relative: string) => join(cache, relative),
  };
}

export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
