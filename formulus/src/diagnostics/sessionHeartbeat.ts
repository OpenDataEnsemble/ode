import { readSession, writeSession } from './DiagnosticLog';
import { logger } from './logger';
import type { SessionHeartbeat } from './types';

export async function beginSession(): Promise<SessionHeartbeat | null> {
  const previous = await readSession();
  const next: SessionHeartbeat = {
    startedAt: new Date().toISOString(),
    appState: 'active',
    cleanExit: false,
  };
  await writeSession(next);
  await logger.breadcrumb('session', 'start');
  return previous;
}

export async function updateAppState(appState: string): Promise<void> {
  const current = (await readSession()) ?? {
    startedAt: new Date().toISOString(),
    appState: 'active',
    cleanExit: false,
  };
  const cleanExit = appState === 'background' || appState === 'inactive';
  await writeSession({
    ...current,
    appState,
    cleanExit,
  });
}
