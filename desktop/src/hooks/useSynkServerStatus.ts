import { useEffect, useRef, useState } from 'react';
import { createLogger } from '../lib/logger';

const statusLogger = createLogger('server-status');

export type SynkServerStatusState = 'live' | 'unconfigured' | 'error';

export function useSynkServerStatus(serverUrl: string, profileLabel: string) {
  const [status, setStatus] = useState<SynkServerStatusState>('unconfigured');
  const [synkronusVersion, setSynkronusVersion] = useState<string | null>(null);
  const hasLoggedVersionErrorRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const trimmed = serverUrl.trim();

    async function checkServerHealth() {
      if (!trimmed) {
        if (!cancelled) {
          setStatus('unconfigured');
          setSynkronusVersion(null);
          hasLoggedVersionErrorRef.current = false;
        }
        return;
      }

      const normalizedBaseUrl = trimmed.replace(/\/+$/, '');
      const healthUrl = `${normalizedBaseUrl}/health`;
      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          cache: 'no-store',
        });
        if (!response.ok) {
          if (!cancelled) {
            setStatus('error');
            setSynkronusVersion(null);
          }
          return;
        }

        const payload = (await response.json()) as {
          status?: string;
          version?: string;
        };
        if (!cancelled) {
          setStatus('live');
          setSynkronusVersion(payload.version ?? null);
        }
        hasLoggedVersionErrorRef.current = false;
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setSynkronusVersion(null);
        }
        if (!hasLoggedVersionErrorRef.current) {
          const message =
            error instanceof Error
              ? error.message
              : 'Unknown error while reading /health';
          statusLogger.warn('Could not read /health', {
            baseUrl: normalizedBaseUrl,
            error: message,
          });
          hasLoggedVersionErrorRef.current = true;
        }
      }
    }

    void checkServerHealth();
    const interval = window.setInterval(() => {
      void checkServerHealth();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [serverUrl]);

  const displayVersion =
    synkronusVersion && synkronusVersion.trim().length > 0
      ? synkronusVersion.startsWith('v')
        ? synkronusVersion
        : `v${synkronusVersion}`
      : null;

  const label =
    status === 'live'
      ? `${profileLabel}: live (${displayVersion ?? 'version unknown'})`
      : status === 'unconfigured'
        ? `${profileLabel}: no server URL`
        : `${profileLabel}: server unreachable`;

  return { status, displayVersion, statusLabel: label };
}
