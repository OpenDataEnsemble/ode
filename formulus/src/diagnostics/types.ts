export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type AllowedLogExtras = {
  phase?: string;
  counts?: number;
  formType?: string;
  screen?: string;
  success?: boolean;
};

export const ALLOWED_EXTRA_KEYS = [
  'phase',
  'counts',
  'formType',
  'screen',
  'success',
] as const;

export type DiagnosticEventKind =
  | 'log'
  | 'breadcrumb'
  | 'js_fatal'
  | 'js_unhandled'
  | 'exit';

export type DiagnosticEvent = {
  ts: string;
  kind: DiagnosticEventKind;
  level?: LogLevel | 'breadcrumb';
  tag?: string;
  message: string;
  extras?: AllowedLogExtras;
  category?: string;
  action?: string;
};

export type ProcessExitRecord = {
  timestamp: number;
  reason: string;
  status?: number;
  importance?: number;
  pssKb?: number;
  rssKb?: number;
  description?: string;
};

export type SessionHeartbeat = {
  startedAt: string;
  appState: string;
  cleanExit: boolean;
};

export type DirtyExit = {
  source: 'aei' | 'heartbeat';
  timestamp: string;
  reason: string;
};

export type DiagnosticFs = {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  appendFile(path: string, contents: string): Promise<void>;
  unlink(path: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  stat(path: string): Promise<{ size: number }>;
};
