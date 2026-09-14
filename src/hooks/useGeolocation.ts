import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
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

  const watchIdRef = useRef<string | number | null>(null);

  const toggleTracking = async () => {
    if (isEnabled) {
      if (watchIdRef.current !== null) {
        if (typeof watchIdRef.current === 'string') {
          Geolocation.clearWatch({ id: watchIdRef.current });
        } else {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        watchIdRef.current = null;
      }
      setIsEnabled(false);
    } else {
      setError(null);
      setIsEnabled(true);

      if (Capacitor.isNativePlatform()) {
        try {
          await Geolocation.requestPermissions();
          const id = await Geolocation.watchPosition(
            { enableHighAccuracy: true },
            (position, err) => {
              if (err) {
                console.warn('Capacitor Geolocation error:', err);
                setError(err.message || 'GPS Fehler');
                return;
              }
              if (position?.coords) {
                setUserCoord({ lat: position.coords.latitude, lng: position.coords.longitude });
                setAccuracy(position.coords.accuracy);
                if (position.coords.speed !== null && !isNaN(position.coords.speed)) {
                  setUserSpeedKmH(position.coords.speed * 3.6);
                }
              }
            }
          );
          watchIdRef.current = id;
          return;
        } catch (nativeErr) {
          console.warn('Native geolocation failed, falling back to browser geolocation', nativeErr);
        }
      }

      if (!navigator.geolocation) {
        setError('Geolocation wird von deinem Gerät nicht unterstützt.');
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
        if (typeof watchIdRef.current === 'string') {
          Geolocation.clearWatch({ id: watchIdRef.current });
        } else {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
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
