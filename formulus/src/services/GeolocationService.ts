import { PermissionsAndroid, Platform } from 'react-native';
import { ObservationGeolocation, GeolocationConfig, GeolocationPosition } from '../types/Geolocation';

// Use React Native's built-in Geolocation API instead of community package
const Geolocation = require('react-native').Geolocation;

/**
 * Service for efficiently managing geolocation capture for observations
 * Keeps location ready and provides non-blocking access
 */
export class GeolocationService {
  private static instance: GeolocationService;
  private currentLocation: ObservationGeolocation | null = null;
  private lastLocationTime: number = 0;
  private isWatching: boolean = false;
  private watchId: number | null = null;
  
  // Configuration for geolocation
  private config: GeolocationConfig = {
    enableHighAccuracy: true,
    timeout: 10000, // 10 seconds
    maximumAge: 300000, // 5 minutes - use cached location if recent
  };

  private constructor() {
    this.startLocationTracking();
  }

  public static getInstance(): GeolocationService {
    if (!GeolocationService.instance) {
      GeolocationService.instance = new GeolocationService();
    }
    return GeolocationService.instance;
  }

  /**
   * Request location permissions (Android only)
   */
  private async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true; // iOS permissions handled via Info.plist
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'Formulus needs access to your location to add geolocation data to observations.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.warn('Location permission request failed:', error);
      return false;
    }
  }

  /**
   * Start background location tracking to keep location ready
   */
  private async startLocationTracking(): Promise<void> {
    if (this.isWatching) {
      return;
    }

    const hasPermission = await this.requestLocationPermission();
    if (!hasPermission) {
      console.warn('Location permission denied - geolocation will not be available');
      return;
    }

    try {
      this.watchId = Geolocation.watchPosition(
        (position: GeolocationPosition) => {
          this.currentLocation = this.convertToObservationGeolocation(position);
          this.lastLocationTime = Date.now();
          console.debug('Location updated:', this.currentLocation);
        },
        (error: any) => {
          console.warn('Location watch error:', error);
          this.currentLocation = null;
        },
        {
          ...this.config,
          distanceFilter: 10, // Update when moved 10 meters
        }
      );
      this.isWatching = true;
      console.debug('Started location tracking');
    } catch (error) {
      console.error('Failed to start location tracking:', error);
    }
  }

  /**
   * Stop location tracking to save battery
   */
  public stopLocationTracking(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isWatching = false;
      console.debug('Stopped location tracking');
    }
  }

  /**
   * Get current location for an observation (non-blocking)
   * Returns cached location if recent, otherwise attempts quick fix
   */
  public async getCurrentLocationForObservation(): Promise<ObservationGeolocation | null> {
    // If we have a recent location (within 5 minutes), use it
    const locationAge = Date.now() - this.lastLocationTime;
    if (this.currentLocation && locationAge < this.config.maximumAge) {
      console.debug('Using cached location (age: ' + Math.round(locationAge / 1000) + 's)');
      return this.currentLocation;
    }

    // Try to get a fresh location with a short timeout
    return new Promise((resolve) => {
      const quickConfig = {
        ...this.config,
        timeout: 5000, // Quick 5-second timeout for observation saving
      };

      Geolocation.getCurrentPosition(
        (position: GeolocationPosition) => {
          const location = this.convertToObservationGeolocation(position);
          this.currentLocation = location;
          this.lastLocationTime = Date.now();
          console.debug('Got fresh location for observation');
          resolve(location);
        },
        (error: any) => {
          console.warn('Failed to get fresh location for observation:', error);
          // Fall back to cached location if available, even if old
          resolve(this.currentLocation);
        },
        quickConfig
      );
    });
  }

  /**
   * Convert React Native geolocation to our observation format
   */
  private convertToObservationGeolocation(position: GeolocationPosition): ObservationGeolocation {
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
  public isLocationAvailable(): boolean {
    return this.currentLocation !== null;
  }

  /**
   * Get the age of the current location in milliseconds
   */
  public getLocationAge(): number {
    return Date.now() - this.lastLocationTime;
  }
}

// Export singleton instance
export const geolocationService = GeolocationService.getInstance();
