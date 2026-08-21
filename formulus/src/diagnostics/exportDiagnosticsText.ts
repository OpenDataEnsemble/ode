export const DIAGNOSTICS_ZIP_FILES = [
  'events.ndjson',
  'exits.ndjson',
  'summary.txt',
] as const;

export function serverHostnameOnly(serverUrl: string | null): string {
  if (!serverUrl) {
    return '(none)';
  }
  try {
    return new URL(serverUrl).hostname || '(none)';
  } catch {
    return '(none)';
  }
}

export function buildSummaryText(input: {
  deviceModel: string;
  systemName: string;
  systemVersion: string;
  appVersion: string;
  serverHost: string;
  lastExitReason: string | null;
  breadcrumbs: string[];
}): string {
  const lines = [
    'Formulus diagnostic summary',
    `device: ${input.deviceModel}`,
    `os: ${input.systemName} ${input.systemVersion}`,
    `app: ${input.appVersion}`,
    `server: ${input.serverHost}`,
    `last dirty/exit reason: ${input.lastExitReason ?? '(none)'}`,
    '',
    'recent breadcrumbs:',
    ...(input.breadcrumbs.length > 0 ? input.breadcrumbs : ['(none)']),
  ];
  return `${lines.join('\n')}\n`;
}
