import Geolocation from '@react-native-community/geolocation';
import {
  ObservationGeolocation,
  GeolocationConfig,
  GeolocationPosition,
} from '../types/Geolocation';
import {
  ensureLocationPermission,
  hasLocationPermission,
} from './LocationPermissions';
import { RESULTS } from 'react-native-permissions';
import { appEvents } from '../webview/FormulusMessageHandlers';

/**
 * Geolocation for observations: one "session" per open form in FormplayerModal.
 *
 * - Clears any prior cache when a new form session starts (avoids reusing another
 *   form's coordinates when the user saves before a new pre-fetch completes).
 * - Refines the stored fix while the form is open: keeps the best horizontal
 *   accuracy seen, with a light watch (battery-conscious intervals / distance).
 * - Accepts a cached fix for up to CACHE_MAX_AGE_MS when saving (prefer stale vs none).
 * - Uses maximumAge 0 on one-shot reads so we do not cement an old fused-network fix.
 *
 */
export class GeolocationService {
  private static instance: GeolocationService;

  /** Used for one-shot reads; maximumAge 0 avoids reusing an OS-cached coarse fix. */
  private readonly freshConfig: GeolocationConfig = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  };

  private cachedLocation: ObservationGeolocation | null = null;
  private cachedAt: number = 0;
  private static readonly CACHE_MAX_AGE_MS = 300_000; // 5 minutes

  private activeSessionCleanup: (() => void) | null = null;

  /** Custom-app watch (map tab) — separate from formplayer observation session. */
  private appWatchFieldId: string | null = null;
  private appWatchCleanup: (() => void) | null = null;

  private constructor() {}

  public static getInstance(): GeolocationService {
    if (!GeolocationService.instance) {
      GeolocationService.instance = new GeolocationService();
    }
    return GeolocationService.instance;
  }

  /**
   * Begin a form session: clear prior state, request an immediate fresh fix, and
   * watch for better accuracy while the form is open. Call the returned cleanup
   * (or `endObservationSession`) when the modal closes.
   */
  public beginObservationSession(): () => void {
    this.endObservationSession();
    this.clearCache();

    let cancelled = false;
    let watchId: number | null = null;

    const cleanup = () => {
      cancelled = true;
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
        watchId = null;
      }
      this.clearCache();
      if (this.activeSessionCleanup === cleanup) {
        this.activeSessionCleanup = null;
      }
    };

    this.activeSessionCleanup = cleanup;

    const merge = (loc: ObservationGeolocation | null) => {
      if (!loc || cancelled) {
        return;
      }
      this.mergeBestCandidate(loc);
    };

    void this.getPositionOnce(this.freshConfig).then(merge);

    void (async () => {
      const ok = await hasLocationPermission();
      if (cancelled || !ok) {
        return;
      }
      watchId = Geolocation.watchPosition(
        position => {
          merge(this.convertToObservationGeolocation(position));
        },
        error => {
          console.warn('Location watch error:', error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 20,
        },
      );
    })();

    return cleanup;
  }

  public endObservationSession(): void {
    if (!this.activeSessionCleanup) {
      return;
    }
    const run = this.activeSessionCleanup;
    this.activeSessionCleanup = null;
    run();
  }

  /**
   * Get current location for an observation (fresh one-shot; not from OS cache).
   */
  public async getCurrentLocationForObservation(): Promise<ObservationGeolocation | null> {
    return this.getPositionOnce(this.freshConfig);
  }

  public async getCurrentPosition(): Promise<ObservationGeolocation | null> {
    return this.getCurrentLocationForObservation();
  }

  /** Return cached best fix if within TTL, otherwise null. */
  public getCachedLocation(): ObservationGeolocation | null {
    if (
      this.cachedLocation &&
      Date.now() - this.cachedAt < GeolocationService.CACHE_MAX_AGE_MS
    ) {
      return this.cachedLocation;
    }
    return null;
  }

  public clearCache(): void {
    this.cachedLocation = null;
    this.cachedAt = 0;
  }

  private emitAppWatchUpdate(
    fieldId: string,
    location: ObservationGeolocation,
  ): void {
    appEvents.emit('locationWatchUpdate', {
      fieldId,
      location: {
        type: 'location' as const,
        latitude: location.latitude || 0,
        longitude: location.longitude || 0,
        accuracy: location.accuracy,
        altitude: location.altitude,
        altitudeAccuracy: location.altitude_accuracy,
        timestamp: location.timestamp ?? new Date().toISOString(),
      },
    });
  }

  /** Start battery-conscious watch for custom apps; returns cleanup. */
  public startAppLocationWatch(fieldId: string): () => void {
    this.stopAppLocationWatch();
    this.appWatchFieldId = fieldId;

    let cancelled = false;
    let watchId: number | null = null;

    const push = (loc: ObservationGeolocation | null) => {
      if (!loc || cancelled || this.appWatchFieldId !== fieldId) return;
      this.mergeBestCandidate(loc);
      this.emitAppWatchUpdate(fieldId, loc);
    };

    void this.getPositionOnce(this.freshConfig).then(push);

    void (async () => {
      const ok = await hasLocationPermission();
      if (cancelled || !ok) return;
      watchId = Geolocation.watchPosition(
        position => push(this.convertToObservationGeolocation(position)),
        error => console.warn('App location watch error:', error),
        { enableHighAccuracy: true, distanceFilter: 20 },
      );
    })();

    const cleanup = () => {
      cancelled = true;
      if (watchId != null) {
        Geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (this.appWatchFieldId === fieldId) {
        this.appWatchFieldId = null;
      }
      if (this.appWatchCleanup === cleanup) {
        this.appWatchCleanup = null;
      }
    };

    this.appWatchCleanup = cleanup;
    return cleanup;
  }

  public stopAppLocationWatch(fieldId?: string): void {
    if (!this.appWatchCleanup) return;
    if (fieldId && this.appWatchFieldId !== fieldId) return;
    const run = this.appWatchCleanup;
    this.appWatchCleanup = null;
    this.appWatchFieldId = null;
    run();
  }

  private async getPositionOnce(
    config: GeolocationConfig,
  ): Promise<ObservationGeolocation | null> {
    try {
      const permissionStatus = await ensureLocationPermission();
      if (permissionStatus !== RESULTS.GRANTED) {
        console.warn('Location permission not granted:', permissionStatus);
        return null;
      }

      return new Promise<ObservationGeolocation | null>(resolve => {
        Geolocation.getCurrentPosition(
          position => {
            const location = this.convertToObservationGeolocation(position);
            console.debug('Got location for observation:', location);
            resolve(location);
          },
          error => {
            console.warn('Failed to get location for observation:', error);
            resolve(null);
          },
          config,
        );
      });
    } catch (error) {
      console.error('Error getting location for observation:', error);
      return null;
    }
  }

  private mergeBestCandidate(incoming: ObservationGeolocation): void {
    const prev = this.cachedLocation;
    if (!prev) {
      this.cachedLocation = incoming;
      this.cachedAt = Date.now();
      return;
    }

    const incAcc = this.accuracyMeters(incoming);
    const prevAcc = this.accuracyMeters(prev);

    if (incAcc < prevAcc) {
      this.cachedLocation = incoming;
      this.cachedAt = Date.now();
      return;
    }

    if (incAcc === prevAcc) {
      const incT = this.fixTimeMs(incoming);
      const prevT = this.fixTimeMs(prev);
      if (incT > prevT) {
        this.cachedLocation = incoming;
        this.cachedAt = Date.now();
      }
    }
  }

  private accuracyMeters(loc: ObservationGeolocation): number {
    const a = loc.accuracy;
    if (a == null || !Number.isFinite(a)) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, a);
  }

  private fixTimeMs(loc: ObservationGeolocation): number {
    if (loc.timestamp) {
      const t = Date.parse(loc.timestamp);
      if (!Number.isNaN(t)) {
        return t;
      }
    }
    return 0;
  }

  private convertToObservationGeolocation(
    position: GeolocationPosition,
  ): ObservationGeolocation {
    const ts =
      position.timestamp != null && Number.isFinite(position.timestamp)
        ? new Date(position.timestamp).toISOString()
        : undefined;
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      altitude_accuracy: position.coords.altitudeAccuracy,
      timestamp: ts,
    };
  }

  public async isLocationAvailable(): Promise<boolean> {
    return await hasLocationPermission();
  }
}

export const geolocationService = GeolocationService.getInstance();
