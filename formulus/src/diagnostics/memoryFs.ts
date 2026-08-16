import type { DiagnosticFs } from './types';

/** In-memory filesystem for unit tests. */
export function createMemoryFs(
  initial: Record<string, string> = {},
): DiagnosticFs {
  const files = new Map<string, string>(Object.entries(initial));
  const dirs = new Set<string>();

  return {
    async exists(path: string) {
      return files.has(path) || dirs.has(path);
    },
    async readFile(path: string) {
      if (!files.has(path)) {
        throw new Error(`ENOENT: ${path}`);
      }
      return files.get(path) as string;
    },
    async writeFile(path: string, contents: string) {
      files.set(path, contents);
    },
    async appendFile(path: string, contents: string) {
      files.set(path, `${files.get(path) ?? ''}${contents}`);
    },
    async unlink(path: string) {
      files.delete(path);
      dirs.delete(path);
    },
    async mkdir(path: string) {
      dirs.add(path);
    },
    async stat(path: string) {
      const contents = files.get(path);
      if (contents == null) {
        throw new Error(`ENOENT: ${path}`);
      }
      return { size: contents.length };
    },
  };
}
