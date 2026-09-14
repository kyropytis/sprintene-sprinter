import type { TravelMode, Waypoint } from '../types/route';
import { calculateRouteDistances } from './geoMath';

export interface SearchResult {
  placeId: number;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Searches for places/addresses using OpenStreetMap Nominatim.
 */
export async function searchAddress(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    query
  )}&limit=6&addressdetails=1`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'de,en',
      },
    });
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    return data.map((item: any) => ({
      placeId: item.place_id,
      name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch (error) {
    console.error('Error in searchAddress:', error);
    return [];
  }
}

/**
 * Reverse geocodes a coordinate to a place name.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'de,en',
      },
    });
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const data = await res.json();
    return data.display_name?.split(',').slice(0, 3).join(',') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

/**
 * Fetches a route from OSRM connecting the given waypoints.
 */
export async function fetchOSRMRoute(
  waypoints: Waypoint[],
  mode: TravelMode = 'walking'
): Promise<{ coordinates: [number, number][]; distanceMeters: number; durationSeconds: number }> {
  if (waypoints.length < 2) {
    throw new Error('Mindestens 2 Wegpunkte für eine Route erforderlich.');
  }

  // Build coordinate string for OSRM: lng1,lat1;lng2,lat2;...
  const coordsString = waypoints.map((w) => `${w.lng},${w.lat}`).join(';');
  const profile = mode === 'cycling' ? 'cycling' : mode === 'driving' ? 'driving' : 'foot';

  const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${coordsString}?overview=full&geometries=geojson&steps=false`;

  try {
    const res = await fetch(osrmUrl);
    if (!res.ok) {
      throw new Error(`Routing Server HTTP ${res.status}`);
    }
    const data = await res.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error('Keine Route gefunden.');
    }

    const route = data.routes[0];
    // OSRM returns GeoJSON coordinates as [lng, lat]. We convert them to [lat, lng] for Leaflet.
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      (pt: [number, number]) => [pt[1], pt[0]]
    );

    return {
      coordinates,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  } catch (error) {
    console.warn('OSRM routing request failed or offline. Falling back to direct lines.', error);

    // Fallback: direct lines between waypoints
    const coordinates: [number, number][] = waypoints.map((w) => [w.lat, w.lng]);
    const { totalDistance } = calculateRouteDistances(coordinates);

    return {
      coordinates,
      distanceMeters: totalDistance,
      durationSeconds: totalDistance / 1.4, // approx walking 5 km/h
    };
  }
}
