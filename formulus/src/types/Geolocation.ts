/**
 * Geolocation data structure matching the API schema
 * All fields are optional as per the OpenAPI specification
 */
export interface ObservationGeolocation {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  altitude?: number | null;
  altitude_accuracy?: number | null;
  /** When the GPS fix was obtained (ISO 8601), from the native position timestamp */
  timestamp?: string;
}

/**
 * React Native Geolocation position data
 */
export interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}

/**
 * Geolocation service configuration
 */
export interface GeolocationConfig {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}
