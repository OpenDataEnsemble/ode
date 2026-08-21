import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useConfirmModal } from '../contexts/ConfirmModalContext';
import { consumePendingDirtyExit } from './consumeDirtyExit';
import { exportDiagnosticsZip } from './exportDiagnostics';
import { logger } from './logger';
import { updateAppState } from './sessionHeartbeat';

/**
 * After i18n + ConfirmModal are up: start a heartbeat session and show a
 * one-shot dialog for a non-garden-variety previous exit.
 */
export function DirtyExitGate(): null {
  const { showConfirm } = useConfirmModal();
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const dirty = await consumePendingDirtyExit();
        if (cancelled || !dirty) {
          return;
        }
        showConfirm({
          title: t('help.diagnostics.unexpectedTitle'),
          message: t('help.diagnostics.unexpectedMessage', {
            reason: dirty.reason,
          }),
          buttons: [
            { text: t('help.diagnostics.ok'), onPress: () => undefined },
            {
              text: t('help.diagnostics.saveLog'),
              variant: 'primary',
              onPress: () => {
                void exportDiagnosticsZip().catch(error => {
                  logger.warn(
                    'diagnostics',
                    error instanceof Error ? error.message : 'export failed',
                  );
                });
              },
            },
          ],
        });
      } catch (error) {
        logger.warn(
          'diagnostics',
          error instanceof Error ? error.message : 'dirty-exit check failed',
        );
      }
    })();

    const sub = AppState.addEventListener('change', state => {
      void updateAppState(state);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [showConfirm, t]);

  return null;
}
