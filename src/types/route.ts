export interface LatLng {
  lat: number;
  lng: number;
}

export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export type TravelMode = 'walking' | 'cycling' | 'driving';

export interface RouteData {
  coordinates: [number, number][]; // [lat, lng] array
  distanceMeters: number; // in meters
  durationsSeconds?: number;
  waypoints: Waypoint[];
  isCustom: boolean;
}

export interface TimeConfig {
  startMode: 'now' | 'custom';
  startTime: string; // ISO string or "HH:mm" / "HH:mm:ss"
  targetTime: string; // "HH:mm" or "HH:mm:ss"
}

export interface PacerStatus {
  active: boolean;
  position: LatLng | null;
  progress: number; // 0 to 1
  requiredSpeedKmH: number;
  paceMinPerKm: number;
  remainingDistanceMeters: number;
  remainingTimeSeconds: number;
  isFinished: boolean;
  hasStarted: boolean;
  elapsedSeconds: number;
  totalDurationSeconds: number;
}

export interface UserTrackingStatus {
  position: LatLng | null;
  distanceToPacerMeters: number | null;
  aheadOrBehind: 'ahead' | 'behind' | 'exact' | null;
  speedKmH: number | null;
}
