import type { DiagnosticEvent, DiagnosticFs, ProcessExitRecord } from './types';
import {
  backupPath,
  eventsPath,
  exitsPath,
  MAX_LOG_BYTES,
  sessionPath,
  tracesDir,
} from './paths';

const DEFAULT_DOC_DIR = '__unset__';

let fsImpl: DiagnosticFs | null = null;
let documentDirectoryPath = DEFAULT_DOC_DIR;
let loadDefaultFsPromise: Promise<DiagnosticFs> | null = null;

export function configureDiagnosticLog(options: {
  fs: DiagnosticFs;
  documentDirectoryPath: string;
}): void {
  fsImpl = options.fs;
  documentDirectoryPath = options.documentDirectoryPath;
}

export function resetDiagnosticLogForTests(): void {
  fsImpl = null;
  documentDirectoryPath = DEFAULT_DOC_DIR;
  loadDefaultFsPromise = null;
}

async function getFs(): Promise<DiagnosticFs> {
  if (fsImpl) {
    return fsImpl;
  }
  if (!loadDefaultFsPromise) {
    loadDefaultFsPromise = (async () => {
      // RNFS ships Flow syntax; keep this lazy so Jest never loads it.
      /* eslint-disable @typescript-eslint/no-require-imports */
      const RNFS =
        require('react-native-fs') as typeof import('react-native-fs');
      /* eslint-enable @typescript-eslint/no-require-imports */
      documentDirectoryPath = RNFS.DocumentDirectoryPath;
      const adapter: DiagnosticFs = {
        exists: path => RNFS.exists(path),
        readFile: path => RNFS.readFile(path, 'utf8'),
        writeFile: (path, contents) => RNFS.writeFile(path, contents, 'utf8'),
        appendFile: (path, contents) => RNFS.appendFile(path, contents, 'utf8'),
        unlink: path => RNFS.unlink(path),
        mkdir: path => RNFS.mkdir(path),
        stat: async path => {
          const info = await RNFS.stat(path);
          return { size: Number(info.size) || 0 };
        },
      };
      fsImpl = adapter;
      return adapter;
    })();
  }
  return loadDefaultFsPromise;
}

function docDir(): string {
  return documentDirectoryPath;
}

export function getEventsFilePath(): string {
  return eventsPath(docDir());
}

export function getExitsFilePath(): string {
  return exitsPath(docDir());
}

export function getSessionFilePath(): string {
  return sessionPath(docDir());
}

export function getTracesDirPath(): string {
  return tracesDir(docDir());
}

async function ensureDir(): Promise<DiagnosticFs> {
  const fs = await getFs();
  const dir = eventsPath(docDir()).replace(/\/[^/]+$/, '');
  if (!(await fs.exists(dir))) {
    await fs.mkdir(dir);
  }
  return fs;
}

async function rotateIfNeeded(
  fs: DiagnosticFs,
  filePath: string,
  incomingBytes: number,
): Promise<void> {
  if (!(await fs.exists(filePath))) {
    return;
  }
  const { size } = await fs.stat(filePath);
  if (size + incomingBytes <= MAX_LOG_BYTES) {
    return;
  }
  const backup = backupPath(filePath);
  if (await fs.exists(backup)) {
    await fs.unlink(backup);
  }
  const current = await fs.readFile(filePath);
  await fs.writeFile(backup, current);
  await fs.writeFile(filePath, '');
}

export async function appendEvent(event: DiagnosticEvent): Promise<void> {
  const line = `${JSON.stringify(event)}\n`;
  const fs = await ensureDir();
  const path = getEventsFilePath();
  await rotateIfNeeded(fs, path, line.length);
  await fs.appendFile(path, line);
}

export async function readRecentEvents(
  max: number = 30,
): Promise<DiagnosticEvent[]> {
  const fs = await getFs();
  const path = getEventsFilePath();
  if (!(await fs.exists(path))) {
    return [];
  }
  const raw = await fs.readFile(path);
  const events: DiagnosticEvent[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) {
      continue;
    }
    try {
      events.push(JSON.parse(line) as DiagnosticEvent);
    } catch {
      // skip malformed
    }
  }
  return events.slice(-Math.max(0, max)).reverse();
}

export async function readExitRecords(): Promise<ProcessExitRecord[]> {
  const fs = await getFs();
  const path = getExitsFilePath();
  if (!(await fs.exists(path))) {
    return [];
  }
  const raw = await fs.readFile(path);
  const records: ProcessExitRecord[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) {
      continue;
    }
    try {
      records.push(JSON.parse(line) as ProcessExitRecord);
    } catch {
      // skip malformed
    }
  }
  return records;
}

export async function readLastExit(): Promise<ProcessExitRecord | null> {
  const records = await readExitRecords();
  return records.length > 0 ? records[records.length - 1] : null;
}

export async function writeSession(session: {
  startedAt: string;
  appState: string;
  cleanExit: boolean;
}): Promise<void> {
  const fs = await ensureDir();
  await fs.writeFile(getSessionFilePath(), JSON.stringify(session));
}

export async function readSession(): Promise<{
  startedAt: string;
  appState: string;
  cleanExit: boolean;
} | null> {
  const fs = await getFs();
  const path = getSessionFilePath();
  if (!(await fs.exists(path))) {
    return null;
  }
  try {
    return JSON.parse(await fs.readFile(path));
  } catch {
    return null;
  }
}

export async function clearDiagnosticFiles(): Promise<void> {
  const fs = await getFs();
  for (const path of [
    getEventsFilePath(),
    getExitsFilePath(),
    backupPath(getEventsFilePath()),
    backupPath(getExitsFilePath()),
  ]) {
    if (await fs.exists(path)) {
      await fs.unlink(path);
    }
  }
}

export async function readFileIfExists(path: string): Promise<string> {
  const fs = await getFs();
  if (!(await fs.exists(path))) {
    return '';
  }
  return fs.readFile(path);
}
