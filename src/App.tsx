import { useState, useEffect, useCallback } from 'react';
import type { LatLng, Waypoint, TravelMode, LineMode, RouteData, TimeConfig } from './types/route';
import { fetchOSRMRoute, reverseGeocode } from './services/routing';
import { calculateRouteDistances } from './services/geoMath';
import { usePacer } from './hooks/usePacer';
import { useGeolocation } from './hooks/useGeolocation';
import { MapView } from './components/MapView';
import { RoutePlanner } from './components/RoutePlanner';
import { TimeControls } from './components/TimeControls';
import { PacerStats } from './components/PacerStats';
import { SimulationBar } from './components/SimulationBar';
import { Flame, Clock, MapPin, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';

// Default initial route (Tiergarten Berlin loop, 3.2 km)
const INITIAL_WAYPOINTS: Waypoint[] = [
  { id: 'wp-1', name: 'Brandenburger Tor', lat: 52.51627, lng: 13.3777 },
  { id: 'wp-2', name: 'Siegessäule', lat: 52.5145, lng: 13.3501 },
  { id: 'wp-3', name: 'Potsdamer Platz', lat: 52.5096, lng: 13.3759 },
];

export function App() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>(INITIAL_WAYPOINTS);
  const [travelMode, setTravelMode] = useState<TravelMode>('walking');
  const [lineMode, setLineMode] = useState<LineMode>('direct'); // Luftlinie by default for custom point routes
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isDesignMode, setIsDesignMode] = useState(false);

  // Time & Pacer config
  const [timeConfig, setTimeConfig] = useState<TimeConfig>(() => {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const ss = now.getSeconds().toString().padStart(2, '0');

    // Default target: 20 minutes from now
    const target = new Date(now.getTime() + 20 * 60 * 1000);
    const targetHh = target.getHours().toString().padStart(2, '0');
    const targetMm = target.getMinutes().toString().padStart(2, '0');

    return {
      startMode: 'now',
      startTime: `${hh}:${mm}:${ss}`,
      targetTime: `${targetHh}:${targetMm}`,
    };
  });

  // Simulation settings
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationMultiplier, setSimulationMultiplier] = useState<number>(5);

  // Active UI card tabs for mobile/desktop
  const [activePanel, setActivePanel] = useState<'route' | 'time' | 'stats' | 'none'>('time');
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);

  // Calculate route with Luftlinie (direct) or OSRM
  const calculateRoute = useCallback(
    async (
      currentWaypoints: Waypoint[],
      mode: TravelMode,
      currentLineMode: LineMode = lineMode
    ) => {
      if (currentWaypoints.length < 2) {
        setRouteData(null);
        return;
      }

      if (currentLineMode === 'direct') {
        // Direct Luftlinie between all waypoints
        const coordinates: [number, number][] = currentWaypoints.map((w) => [w.lat, w.lng]);
        const { totalDistance } = calculateRouteDistances(coordinates);

        setRouteData({
          coordinates,
          distanceMeters: totalDistance,
          durationsSeconds: totalDistance / (mode === 'cycling' ? 4.5 : mode === 'driving' ? 10 : 1.4),
          waypoints: currentWaypoints,
          isCustom: true,
          lineMode: 'direct',
        });
        return;
      }

      setIsLoadingRoute(true);
      try {
        const res = await fetchOSRMRoute(currentWaypoints, mode);
        setRouteData({
          coordinates: res.coordinates,
          distanceMeters: res.distanceMeters,
          durationsSeconds: res.durationSeconds,
          waypoints: currentWaypoints,
          isCustom: false,
          lineMode: 'osrm',
        });
      } catch (err) {
        console.error('Error fetching route:', err);
      } finally {
        setIsLoadingRoute(false);
      }
    },
    [lineMode]
  );

  // Initial load & when travel mode changes
  useEffect(() => {
    calculateRoute(waypoints, travelMode, lineMode);
  }, [travelMode, lineMode]);

  // Hook for Pacer calculations & movement
  const {
    pacerStatus,
    isPlaying,
    togglePlay,
    setProgress,
    resetSimulation,
  } = usePacer({
    route: routeData,
    timeConfig,
    simulationMultiplier,
    isSimulating,
  });

  // Hook for GPS Tracking & Ghost comparison
  const {
    isEnabled: isGpsEnabled,
    toggleTracking: toggleGps,
    userCoord,
    error: gpsError,
    trackingStatus: userTracking,
  } = useGeolocation({
    route: routeData,
    pacerProgressMeters:
      (pacerStatus.progress || 0) * (routeData?.distanceMeters || 0),
  });

  // Waypoint operations
  const handleAddWaypoint = async (coord: LatLng, name?: string) => {
    const newId = `wp-${Date.now()}`;
    const placeName = name || (await reverseGeocode(coord.lat, coord.lng));
    const newWp: Waypoint = {
      id: newId,
      name: placeName,
      lat: coord.lat,
      lng: coord.lng,
    };

    const nextWaypoints = [...waypoints, newWp];
    setWaypoints(nextWaypoints);
    calculateRoute(nextWaypoints, travelMode, lineMode);
  };

  const handleUpdateWaypoint = (id: string, coord: LatLng) => {
    const nextWaypoints = waypoints.map((w) =>
      w.id === id ? { ...w, lat: coord.lat, lng: coord.lng } : w
    );
    setWaypoints(nextWaypoints);
    calculateRoute(nextWaypoints, travelMode, lineMode);
  };

  const handleRemoveWaypoint = (id: string) => {
    const nextWaypoints = waypoints.filter((w) => w.id !== id);
    setWaypoints(nextWaypoints);
    calculateRoute(nextWaypoints, travelMode, lineMode);
  };

  const handleSetWaypoints = (newWaypoints: Waypoint[]) => {
    setWaypoints(newWaypoints);
    calculateRoute(newWaypoints, travelMode, lineMode);
  };

  const handleReverseRoute = () => {
    const reversed = [...waypoints].reverse();
    setWaypoints(reversed);
    calculateRoute(reversed, travelMode, lineMode);
  };

  const resetStartToNow = () => {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const ss = now.getSeconds().toString().padStart(2, '0');
    setTimeConfig({
      ...timeConfig,
      startMode: 'now',
      startTime: `${hh}:${mm}:${ss}`,
    });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 1. Map Layer (Full background) */}
      <MapView
        route={routeData}
        waypoints={waypoints}
        onAddWaypoint={handleAddWaypoint}
        onUpdateWaypoint={handleUpdateWaypoint}
        isDesignMode={isDesignMode}
        pacerPosition={pacerStatus.position}
        pacerBearing={pacerStatus.bearing}
        userPosition={userCoord}
        pacerSpeedKmH={pacerStatus.requiredSpeedKmH}
      />

      {/* 2. Top Header Bar */}
      <header className="absolute top-3 left-3 right-3 sm:left-6 sm:right-6 pointer-events-none flex items-center justify-between z-20">
        <div className="flex items-center gap-2.5 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-800 shadow-xl pointer-events-auto">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5 leading-none">
              Sprintene Sprinter
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Pacer
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
              Idealpunkt-Streckenrechner
            </p>
          </div>
        </div>

        {/* Quick Nav Switches */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border border-slate-800 shadow-xl pointer-events-auto">
          <button
            onClick={() => {
              setActivePanel('route');
              setIsPanelMinimized(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              activePanel === 'route'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Route</span>
          </button>
          <button
            onClick={() => {
              setActivePanel('time');
              setIsPanelMinimized(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              activePanel === 'time'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Zielzeit</span>
          </button>
          <button
            onClick={() => {
              setActivePanel('stats');
              setIsPanelMinimized(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              activePanel === 'stats'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Status</span>
          </button>
        </div>
      </header>

      {/* 3. Floating Sidebar Panel (Left / Bottom-sheet on mobile) */}
      <div className="absolute top-16 left-3 sm:left-6 w-[calc(100vw-24px)] sm:w-96 max-h-[calc(100vh-140px)] z-20 flex flex-col gap-3 pointer-events-none">
        <div className="pointer-events-auto transition-all duration-300">
          {/* Active Panel View */}
          {!isPanelMinimized && (
            <div>
              {activePanel === 'route' && (
                <RoutePlanner
                  waypoints={waypoints}
                  travelMode={travelMode}
                  onTravelModeChange={setTravelMode}
                  lineMode={lineMode}
                  onLineModeChange={(m) => {
                    setLineMode(m);
                    calculateRoute(waypoints, travelMode, m);
                  }}
                  onSetWaypoints={handleSetWaypoints}
                  onRemoveWaypoint={handleRemoveWaypoint}
                  onReverseRoute={handleReverseRoute}
                  isDesignMode={isDesignMode}
                  onToggleDesignMode={() => setIsDesignMode((prev) => !prev)}
                  totalDistanceMeters={routeData?.distanceMeters || 0}
                  isLoading={isLoadingRoute}
                />
              )}

              {activePanel === 'time' && (
                <TimeControls
                  timeConfig={timeConfig}
                  onTimeConfigChange={setTimeConfig}
                  onResetToNow={resetStartToNow}
                  requiredSpeedKmH={pacerStatus.requiredSpeedKmH}
                  paceMinPerKm={pacerStatus.paceMinPerKm}
                />
              )}

              {activePanel === 'stats' && (
                <PacerStats
                  pacerStatus={pacerStatus}
                  userTracking={userTracking}
                  isGpsEnabled={isGpsEnabled}
                  onToggleGps={toggleGps}
                  gpsError={gpsError}
                />
              )}
            </div>
          )}

          {/* Minimize / Toggle Panel Bar */}
          <button
            onClick={() => setIsPanelMinimized(!isPanelMinimized)}
            className="mt-1 w-full bg-slate-900/80 hover:bg-slate-900 backdrop-blur-md border border-slate-800 py-1 rounded-xl text-slate-400 text-xs flex items-center justify-center gap-1 shadow-md transition"
          >
            {isPanelMinimized ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> Menü anzeigen
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Minimieren
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4. Bottom Simulation Bar */}
      <div className="absolute bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-20 pointer-events-auto">
        <SimulationBar
          isSimulating={isSimulating}
          onToggleSimulating={() => setIsSimulating(!isSimulating)}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          progress={pacerStatus.progress}
          onScrub={setProgress}
          onReset={resetSimulation}
          multiplier={simulationMultiplier}
          onMultiplierChange={setSimulationMultiplier}
        />
      </div>
    </div>
  );
}
export default App;
