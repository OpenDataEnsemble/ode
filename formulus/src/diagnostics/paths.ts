export const DIAGNOSTICS_DIR_NAME = 'diagnostics';
export const EVENTS_FILE_NAME = 'events.ndjson';
export const EXITS_FILE_NAME = 'exits.ndjson';
export const SESSION_FILE_NAME = 'session.json';
export const MAX_LOG_BYTES = 256 * 1024;

export function diagnosticsDir(documentDirectoryPath: string): string {
  return `${documentDirectoryPath}/${DIAGNOSTICS_DIR_NAME}`;
}

export function eventsPath(documentDirectoryPath: string): string {
  return `${diagnosticsDir(documentDirectoryPath)}/${EVENTS_FILE_NAME}`;
}

export function exitsPath(documentDirectoryPath: string): string {
  return `${diagnosticsDir(documentDirectoryPath)}/${EXITS_FILE_NAME}`;
}

export function sessionPath(documentDirectoryPath: string): string {
  return `${diagnosticsDir(documentDirectoryPath)}/${SESSION_FILE_NAME}`;
}

export function backupPath(filePath: string): string {
  return `${filePath}.1`;
}
