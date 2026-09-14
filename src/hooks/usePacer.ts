import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { RouteData, TimeConfig, PacerStatus } from '../types/route';
import {
  calculateRouteDistances,
  interpolateRoutePosition,
} from '../services/geoMath';

export interface PacerOptions {
  route: RouteData | null;
  timeConfig: TimeConfig;
  simulationMultiplier?: number;
  isSimulating?: boolean;
}

export function usePacer({
  route,
  timeConfig,
  simulationMultiplier = 1,
  isSimulating = false,
}: PacerOptions) {
  // Parsed target & start timestamps in milliseconds
  const [liveTimestamp, setLiveTimestamp] = useState<number>(Date.now());
  const [simulatedTimestamp, setSimulatedTimestamp] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Keep track of route distances cache
  const routeDistances = useMemo(() => {
    if (!route || route.coordinates.length < 2) {
      return { totalDistance: 0, cumulativeDistances: [0] };
    }
    return calculateRouteDistances(route.coordinates);
  }, [route]);

  // Compute start timestamp in ms
  const startTimestampMs = useMemo(() => {
    const now = new Date();
    if (timeConfig.startMode === 'now') {
      // If start time is empty or now, use initial or custom set time
      if (!timeConfig.startTime) {
        return now.getTime();
      }
    }

    // Parse "HH:mm" or "HH:mm:ss"
    const parts = timeConfig.startTime.split(':').map((p) => parseInt(p, 10));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const d = new Date();
      d.setHours(parts[0], parts[1], parts[2] || 0, 0);
      return d.getTime();
    }

    return now.getTime();
  }, [timeConfig.startMode, timeConfig.startTime]);

  // Compute target timestamp in ms (at exact beginning of the target minute :00)
  const targetTimestampMs = useMemo(() => {
    const parts = timeConfig.targetTime.split(':').map((p) => parseInt(p, 10));
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      // Default fallback: 30 minutes from start
      return startTimestampMs + 30 * 60 * 1000;
    }

    const d = new Date(startTimestampMs);
    d.setHours(parts[0], parts[1], parts[2] || 0, 0);

    // If target time is before or equal to start time on the same day, assume it's next day
    if (d.getTime() <= startTimestampMs) {
      d.setDate(d.getDate() + 1);
    }

    return d.getTime();
  }, [timeConfig.targetTime, startTimestampMs]);

  // Reset simulation time when route or timeConfig changes
  useEffect(() => {
    if (isSimulating) {
      setSimulatedTimestamp(startTimestampMs);
    }
  }, [isSimulating, startTimestampMs, targetTimestampMs]);

  // Animation frame / timer loop
  const animFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(performance.now());

  useEffect(() => {
    let active = true;

    const tick = (nowTime: number) => {
      if (!active) return;
      const dt = (nowTime - lastTickRef.current) / 1000; // in seconds
      lastTickRef.current = nowTime;

      if (isSimulating) {
        if (isPlaying) {
          setSimulatedTimestamp((prev) => {
            const current = prev ?? startTimestampMs;
            const next = current + dt * 1000 * simulationMultiplier;
            if (next >= targetTimestampMs) {
              return targetTimestampMs;
            }
            return next;
          });
        }
      } else {
        setLiveTimestamp(Date.now());
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    lastTickRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isSimulating, isPlaying, simulationMultiplier, startTimestampMs, targetTimestampMs]);

  // Current active timestamp
  const currentTimestamp = isSimulating
    ? simulatedTimestamp ?? startTimestampMs
    : liveTimestamp;

  // Calculate pacer state
  const pacerStatus: PacerStatus & { bearing: number } = useMemo(() => {
    const totalDist = routeDistances.totalDistance;
    const totalDurationSeconds = Math.max(1, (targetTimestampMs - startTimestampMs) / 1000);

    // Speed calculation
    const speedMetersPerSecond = totalDist / totalDurationSeconds;
    const requiredSpeedKmH = (speedMetersPerSecond * 3600) / 1000;
    const paceMinPerKm =
      totalDist > 0 ? totalDurationSeconds / 60 / (totalDist / 1000) : 0;

    if (!route || route.coordinates.length < 2 || totalDist === 0) {
      return {
        active: false,
        position: null,
        bearing: 0,
        progress: 0,
        requiredSpeedKmH,
        paceMinPerKm,
        remainingDistanceMeters: 0,
        remainingTimeSeconds: totalDurationSeconds,
        isFinished: false,
        hasStarted: false,
        elapsedSeconds: 0,
        totalDurationSeconds,
      };
    }

    const elapsedSeconds = (currentTimestamp - startTimestampMs) / 1000;
    const remainingTimeSeconds = Math.max(0, (targetTimestampMs - currentTimestamp) / 1000);

    let progress = 0;
    let hasStarted = false;
    let isFinished = false;

    if (currentTimestamp < startTimestampMs) {
      progress = 0;
      hasStarted = false;
    } else if (currentTimestamp >= targetTimestampMs) {
      progress = 1;
      hasStarted = true;
      isFinished = true;
    } else {
      progress = (currentTimestamp - startTimestampMs) / (targetTimestampMs - startTimestampMs);
      hasStarted = true;
    }

    const targetDistanceMeters = progress * totalDist;
    const remainingDistanceMeters = Math.max(0, totalDist - targetDistanceMeters);

    const { position, bearing } = interpolateRoutePosition(
      route.coordinates,
      targetDistanceMeters,
      routeDistances.cumulativeDistances
    );

    return {
      active: true,
      position,
      bearing,
      progress,
      requiredSpeedKmH,
      paceMinPerKm,
      remainingDistanceMeters,
      remainingTimeSeconds,
      isFinished,
      hasStarted,
      elapsedSeconds: Math.max(0, elapsedSeconds),
      totalDurationSeconds,
    };
  }, [route, routeDistances, startTimestampMs, targetTimestampMs, currentTimestamp]);

  // Scrub progress manually (for slider)
  const setProgress = useCallback(
    (fraction: number) => {
      const clamped = Math.max(0, Math.min(1, fraction));
      const targetTime = startTimestampMs + clamped * (targetTimestampMs - startTimestampMs);
      setSimulatedTimestamp(targetTime);
    },
    [startTimestampMs, targetTimestampMs]
  );

  const resetSimulation = useCallback(() => {
    setSimulatedTimestamp(startTimestampMs);
    setIsPlaying(true);
  }, [startTimestampMs]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  return {
    pacerStatus,
    currentTimestamp,
    startTimestampMs,
    targetTimestampMs,
    isPlaying,
    togglePlay,
    setProgress,
    resetSimulation,
  };
}
