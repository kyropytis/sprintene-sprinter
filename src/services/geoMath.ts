import type { LatLng } from '../types/route';

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculates haversine distance between two points in meters.
 */
export function calculateDistance(p1: LatLng, p2: LatLng): number {
  const dLat = toRadians(p2.lat - p1.lat);
  const dLng = toRadians(p2.lng - p1.lng);
  const lat1 = toRadians(p1.lat);
  const lat2 = toRadians(p2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates total distance of a route and returns cumulative distance array.
 */
export function calculateRouteDistances(coordinates: [number, number][]): {
  totalDistance: number;
  cumulativeDistances: number[];
} {
  if (coordinates.length < 2) {
    return { totalDistance: 0, cumulativeDistances: [0] };
  }

  const cumulativeDistances: number[] = [0];
  let total = 0;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const p1: LatLng = { lat: coordinates[i][0], lng: coordinates[i][1] };
    const p2: LatLng = { lat: coordinates[i + 1][0], lng: coordinates[i + 1][1] };
    const dist = calculateDistance(p1, p2);
    total += dist;
    cumulativeDistances.push(total);
  }

  return { totalDistance: total, cumulativeDistances };
}

/**
 * Calculates initial bearing (angle 0-360) from p1 to p2.
 */
export function calculateBearing(p1: LatLng, p2: LatLng): number {
  const lat1 = toRadians(p1.lat);
  const lat2 = toRadians(p2.lat);
  const dLng = toRadians(p2.lng - p1.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  let brng = toDegrees(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Interpolates a position and bearing along a polyline at a given distance in meters.
 */
export function interpolateRoutePosition(
  coordinates: [number, number][],
  targetDistanceMeters: number,
  cumulativeDistances?: number[]
): { position: LatLng; bearing: number } {
  if (coordinates.length === 0) {
    return { position: { lat: 0, lng: 0 }, bearing: 0 };
  }
  if (coordinates.length === 1) {
    return { position: { lat: coordinates[0][0], lng: coordinates[0][1] }, bearing: 0 };
  }

  const cumDist =
    cumulativeDistances || calculateRouteDistances(coordinates).cumulativeDistances;
  const totalDist = cumDist[cumDist.length - 1];

  if (targetDistanceMeters <= 0) {
    const p1 = { lat: coordinates[0][0], lng: coordinates[0][1] };
    const p2 = { lat: coordinates[1][0], lng: coordinates[1][1] };
    return { position: p1, bearing: calculateBearing(p1, p2) };
  }

  if (targetDistanceMeters >= totalDist) {
    const n = coordinates.length;
    const pPrev = { lat: coordinates[n - 2][0], lng: coordinates[n - 2][1] };
    const pLast = { lat: coordinates[n - 1][0], lng: coordinates[n - 1][1] };
    return { position: pLast, bearing: calculateBearing(pPrev, pLast) };
  }

  // Binary search for the segment
  let low = 0;
  let high = cumDist.length - 1;
  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    if (cumDist[mid] <= targetDistanceMeters) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const segStartDist = cumDist[low];
  const segEndDist = cumDist[low + 1];
  const segLength = segEndDist - segStartDist;

  const p1: LatLng = { lat: coordinates[low][0], lng: coordinates[low][1] };
  const p2: LatLng = { lat: coordinates[low + 1][0], lng: coordinates[low + 1][1] };

  if (segLength === 0) {
    return { position: p1, bearing: 0 };
  }

  const fraction = (targetDistanceMeters - segStartDist) / segLength;
  const lat = p1.lat + (p2.lat - p1.lat) * fraction;
  const lng = p1.lng + (p2.lng - p1.lng) * fraction;
  const bearing = calculateBearing(p1, p2);

  return {
    position: { lat, lng },
    bearing,
  };
}

/**
 * Projects a point onto a line segment [a, b] in Cartesian planar approximation (accurate for local distances).
 * Returns the nearest point and the fraction along the segment.
 */
function projectPointOnSegment(p: LatLng, a: LatLng, b: LatLng): { point: LatLng; fraction: number } {
  const dx = (b.lng - a.lng) * Math.cos(toRadians((a.lat + b.lat) / 2));
  const dy = b.lat - a.lat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return { point: a, fraction: 0 };
  }

  const px = (p.lng - a.lng) * Math.cos(toRadians((a.lat + b.lat) / 2));
  const py = p.lat - a.lat;

  let t = (px * dx + py * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    point: {
      lat: a.lat + t * (b.lat - a.lat),
      lng: a.lng + t * (b.lng - a.lng),
    },
    fraction: t,
  };
}

/**
 * Finds the closest point on the route for a given user coordinate,
 * and calculates the distance along the route (in meters) from the start.
 */
export function findRouteProgressOfPoint(
  coordinates: [number, number][],
  userPoint: LatLng,
  cumulativeDistances?: number[]
): {
  closestPoint: LatLng;
  distanceAlongRouteMeters: number;
  distanceFromRouteMeters: number;
} {
  if (coordinates.length < 2) {
    const single = coordinates.length === 1 ? { lat: coordinates[0][0], lng: coordinates[0][1] } : userPoint;
    const dist = calculateDistance(userPoint, single);
    return {
      closestPoint: single,
      distanceAlongRouteMeters: 0,
      distanceFromRouteMeters: dist,
    };
  }

  const cumDist =
    cumulativeDistances || calculateRouteDistances(coordinates).cumulativeDistances;

  let minDistanceToSegment = Infinity;
  let bestProgressDist = 0;
  let bestClosestPoint: LatLng = { lat: coordinates[0][0], lng: coordinates[0][1] };

  for (let i = 0; i < coordinates.length - 1; i++) {
    const a: LatLng = { lat: coordinates[i][0], lng: coordinates[i][1] };
    const b: LatLng = { lat: coordinates[i + 1][0], lng: coordinates[i + 1][1] };

    const { point, fraction } = projectPointOnSegment(userPoint, a, b);
    const distToUser = calculateDistance(userPoint, point);

    if (distToUser < minDistanceToSegment) {
      minDistanceToSegment = distToUser;
      bestClosestPoint = point;
      const segStartDist = cumDist[i];
      const segLength = cumDist[i + 1] - segStartDist;
      bestProgressDist = segStartDist + fraction * segLength;
    }
  }

  return {
    closestPoint: bestClosestPoint,
    distanceAlongRouteMeters: bestProgressDist,
    distanceFromRouteMeters: minDistanceToSegment,
  };
}

/**
 * Format helpers for UI display
 */
export function formatPace(paceMinPerKm: number): string {
  if (!isFinite(paceMinPerKm) || paceMinPerKm <= 0 || paceMinPerKm > 60) {
    return '--:-- min/km';
  }
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs} min/km`;
}

export function formatDuration(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return '00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}
