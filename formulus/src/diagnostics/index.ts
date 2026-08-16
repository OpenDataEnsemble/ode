export { logger, persistWebViewConsole, webViewTag } from './logger';
export { installErrorHandlers } from './installErrorHandlers';
export { consumePendingDirtyExit } from './consumeDirtyExit';
export { updateAppState } from './sessionHeartbeat';
export {
  exportDiagnosticsZip,
  DIAGNOSTICS_ZIP_FILES,
} from './exportDiagnostics';
export {
  readRecentEvents,
  readLastExit,
  clearDiagnosticFiles,
} from './DiagnosticLog';
export type { DiagnosticEvent, DirtyExit, ProcessExitRecord } from './types';
