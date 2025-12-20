import Geolocation from 'react-native-geolocation-service';
import {ObservationGeolocation, GeolocationConfig} from '../types/Geolocation';
import {
  ensureLocationPermission,
  hasLocationPermission,
} from './LocationPermissions';
import {RESULTS} from 'react-native-permissions';

/**
 * Service for on-demand geolocation capture for observations
 * Uses react-native-geolocation-service for reliable location access
 */
export class GeolocationService {
  private static instance: GeolocationService;

  // Configuration for geolocation
  private config: GeolocationConfig = {
    enableHighAccuracy: true,
    timeout: 10000, // 10 seconds
    maximumAge: 10000, // 10 seconds - use cached location if very recent
  };

  private constructor() {
    // No continuous tracking - we get location on demand
  }

  public static getInstance(): GeolocationService {
    if (!GeolocationService.instance) {
      GeolocationService.instance = new GeolocationService();
    }
    return GeolocationService.instance;
  }

  /**
   * Get current location for an observation
   * Uses react-native-geolocation-service for reliable location access
   */
  public async getCurrentLocationForObservation(): Promise<ObservationGeolocation | null> {
    try {
      // Check and request permissions first
      const permissionStatus = await ensureLocationPermission();
      if (permissionStatus !== RESULTS.GRANTED) {
        console.warn('Location permission not granted:', permissionStatus);
        return null;
      }

      // Get current position using react-native-geolocation-service
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
          {
            ...this.config,
            forceRequestLocation: true,
            showLocationDialog: true,
          },
        );
      });
    } catch (error) {
      console.error('Error getting location for observation:', error);
      return null;
    }
  }

  /**
   * Get current location with Promise-based API
   * Useful for other parts of the app that need location
   */
  public async getCurrentPosition(): Promise<ObservationGeolocation | null> {
    return this.getCurrentLocationForObservation();
  }

  /**
   * Start watching position (for future use if needed)
   * Returns a cleanup function to stop watching
   */
  public startWatching(
    onUpdate: (location: ObservationGeolocation) => void,
  ): () => void {
    let watchId: number | null = null;

    const startWatch = async () => {
      const hasPermission = await hasLocationPermission();
      if (!hasPermission) {
        console.warn('Location permission not available for watching');
        return;
      }

      watchId = Geolocation.watchPosition(
        position => {
          const location = this.convertToObservationGeolocation(position);
          onUpdate(location);
        },
        error => {
          console.warn('Location watch error:', error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 25, // Battery-friendly: update when moved 25 meters
          interval: 10000, // 10 seconds
          fastestInterval: 5000, // 5 seconds
        },
      );
    };

    startWatch();

    // Return cleanup function
    return () => {
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
        watchId = null;
      }
    };
  }

  /**
   * Convert react-native-geolocation-service position to our observation format
   */
  private convertToObservationGeolocation(
    position: Geolocation.GeoPosition,
  ): ObservationGeolocation {
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      altitude_accuracy: position.coords.altitudeAccuracy,
    };
  }

  /**
   * Check if location services are available
   */
  public async isLocationAvailable(): Promise<boolean> {
    return await hasLocationPermission();
  }
}

// Export singleton instance
export const geolocationService = GeolocationService.getInstance();
