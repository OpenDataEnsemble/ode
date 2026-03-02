/**
 * Sets up global axios interceptors for Synkronus API client.
 * This file should be imported early in the app lifecycle to ensure
 * all API calls are intercepted.
 */
import globalAxios from 'axios';
import { VersionMismatchError } from '../../errors/VersionMismatchError';

/**
 * Configure axios interceptors for version mismatch handling.
 * Detects HTTP 426 (Upgrade Required) responses and converts them
 * to VersionMismatchError instances.
 */
export function setupSynkronusClientInterceptors(): void {
  // Response interceptor: convert 426 responses to VersionMismatchError
  globalAxios.interceptors.response.use(
    response => response,
    error => {
      // Check if this is a 426 Upgrade Required response
      if (error?.response?.status === 426) {
        const data = error.response.data;
        throw new VersionMismatchError(
          data?.message,
          data?.synkronus_version || 'unknown',
        );
      }
      return Promise.reject(error);
    },
  );
}
