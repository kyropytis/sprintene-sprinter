import { useState, useEffect, useRef } from 'react';
import type { LatLng, RouteData, UserTrackingStatus } from '../types/route';
import { findRouteProgressOfPoint } from '../services/geoMath';

interface UseGeolocationOptions {
  route: RouteData | null;
  pacerProgressMeters: number;
}

export function useGeolocation({
  route,
  pacerProgressMeters,
}: UseGeolocationOptions) {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [userCoord, setUserCoord] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userSpeedKmH, setUserSpeedKmH] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);

  const toggleTracking = () => {
    if (isEnabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsEnabled(false);
    } else {
      if (!navigator.geolocation) {
        setError('Geolocation wird von deinem Browser leider nicht unterstützt.');
        return;
      }
      setError(null);
      setIsEnabled(true);

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserCoord({ lat, lng });
          setAccuracy(pos.coords.accuracy);

          if (pos.coords.speed !== null && !isNaN(pos.coords.speed)) {
            setUserSpeedKmH(pos.coords.speed * 3.6);
          }
        },
        (err) => {
          console.warn('Geolocation error:', err);
          setError(err.message || 'Konnte GPS-Standort nicht abrufen.');
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 10000,
        }
      );
    }
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Compute status relative to pacer
  const trackingStatus: UserTrackingStatus = {
    position: userCoord,
    distanceToPacerMeters: null,
    aheadOrBehind: null,
    speedKmH: userSpeedKmH,
  };

  if (userCoord && route && route.coordinates.length >= 2) {
    const { distanceAlongRouteMeters } = findRouteProgressOfPoint(
      route.coordinates,
      userCoord
    );

    const delta = distanceAlongRouteMeters - pacerProgressMeters;
    trackingStatus.distanceToPacerMeters = Math.abs(delta);

    if (Math.abs(delta) < 5) {
      trackingStatus.aheadOrBehind = 'exact';
    } else if (delta > 0) {
      trackingStatus.aheadOrBehind = 'ahead';
    } else {
      trackingStatus.aheadOrBehind = 'behind';
    }
  }

  return {
    isEnabled,
    toggleTracking,
    userCoord,
    accuracy,
    error,
    trackingStatus,
  };
}
