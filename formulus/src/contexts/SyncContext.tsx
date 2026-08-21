import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { syncService as syncServiceInstance } from '../services/SyncService';
import { i18n } from '../i18n/instance';

export type { SyncProgress, SyncProgressPhase } from '../sync/syncProgress';
export type { SyncProgressReporter } from '../sync/syncProgress';
import type { SyncProgress } from '../sync/syncProgress';

export interface SyncState {
  isActive: boolean;
  progress?: SyncProgress;
  canCancel: boolean;
  error?: string;
  lastSyncTime?: Date;
}

interface SyncContextType {
  syncState: SyncState;
  startSync: (canCancel?: boolean) => void;
  updateProgress: (progress: SyncProgress) => void;
  finishSync: (error?: string) => void;
  cancelSync: () => void;
  clearError: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [syncState, setSyncState] = useState<SyncState>({
    isActive: false,
    canCancel: false,
  });

  const startSync = useCallback((canCancel: boolean = true) => {
    setSyncState({
      isActive: true,
      canCancel,
      error: undefined,
      progress: undefined,
    });
  }, []);

  const updateProgress = useCallback((progress: SyncProgress) => {
    setSyncState(prev => ({
      ...prev,
      progress,
    }));
  }, []);

  const finishSync = useCallback((error?: string) => {
    setSyncState(prev => ({
      ...prev,
      isActive: false,
      canCancel: false,
      error,
      lastSyncTime: error ? prev.lastSyncTime : new Date(),
      progress: undefined,
    }));
  }, []);

  const cancelSync = useCallback(() => {
    syncServiceInstance.cancelSync();
    // Keep isActive until the in-flight syncObservations/updateAppBundle
    // finally-block clears isSyncing. Flipping it here re-enabled the Sync
    // button while the service was still busy, and the next tap threw
    // "Sync already in progress".
    setSyncState(prev => ({
      ...prev,
      canCancel: false,
      progress: prev.progress
        ? {
            ...prev.progress,
            details: i18n.t('sync.progress.cancelling'),
          }
        : prev.progress,
    }));
  }, []);

  const clearError = useCallback(() => {
    setSyncState(prev => ({
      ...prev,
      error: undefined,
    }));
  }, []);

  const value: SyncContextType = {
    syncState,
    startSync,
    updateProgress,
    finishSync,
    cancelSync,
    clearError,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export const useSyncContext = (): SyncContextType => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncContext must be used within a SyncProvider');
  }
  return context;
};
