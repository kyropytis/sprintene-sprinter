import { useState, useEffect, useRef } from 'react';
import type { Waypoint, TravelMode } from '../types/route';
import { searchAddress, type SearchResult } from '../services/routing';
import {
  MapPin,
  Footprints,
  Bike,
  Car,
  Trash2,
  ArrowUpDown,
  LocateFixed,
  Pencil,
  Compass,
} from 'lucide-react';

interface RoutePlannerProps {
  waypoints: Waypoint[];
  travelMode: TravelMode;
  onTravelModeChange: (mode: TravelMode) => void;
  onSetWaypoints: (waypoints: Waypoint[]) => void;
  onRemoveWaypoint: (id: string) => void;
  onReverseRoute: () => void;
  isDesignMode: boolean;
  onToggleDesignMode: () => void;
  totalDistanceMeters: number;
  isLoading: boolean;
}

export const RoutePlanner = ({
  waypoints,
  travelMode,
  onTravelModeChange,
  onSetWaypoints,
  onRemoveWaypoint,
  onReverseRoute,
  isDesignMode,
  onToggleDesignMode,
  totalDistanceMeters,
  isLoading,
}: RoutePlannerProps) => {
  const [plannerTab, setPlannerTab] = useState<'standard' | 'custom'>('standard');

  // Search state for Start
  const [startQuery, setStartQuery] = useState('');
  const [startResults, setStartResults] = useState<SearchResult[]>([]);

  // Search state for Destination
  const [destQuery, setDestQuery] = useState('');
  const [destResults, setDestResults] = useState<SearchResult[]>([]);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update query inputs if waypoints change externally
  useEffect(() => {
    if (waypoints.length > 0 && waypoints[0]?.name) {
      setStartQuery(waypoints[0].name);
    } else if (waypoints.length === 0) {
      setStartQuery('');
    }

    if (waypoints.length > 1 && waypoints[waypoints.length - 1]?.name) {
      setDestQuery(waypoints[waypoints.length - 1].name);
    } else if (waypoints.length < 2) {
      setDestQuery('');
    }
  }, [waypoints]);

  const handleStartSearch = (val: string) => {
    setStartQuery(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (val.trim().length < 3) {
      setStartResults([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      const results = await searchAddress(val);
      setStartResults(results);
    }, 400);
  };

  const handleDestSearch = (val: string) => {
    setDestQuery(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (val.trim().length < 3) {
      setDestResults([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      const results = await searchAddress(val);
      setDestResults(results);
    }, 400);
  };

  const selectStartPlace = (item: SearchResult) => {
    setStartQuery(item.name);
    setStartResults([]);
    const startWp: Waypoint = {
      id: 'start',
      name: item.name.split(',')[0],
      lat: item.lat,
      lng: item.lng,
    };

    if (waypoints.length > 1) {
      onSetWaypoints([startWp, ...waypoints.slice(1)]);
    } else {
      onSetWaypoints([startWp]);
    }
  };

  const selectDestPlace = (item: SearchResult) => {
    setDestQuery(item.name);
    setDestResults([]);
    const destWp: Waypoint = {
      id: 'finish',
      name: item.name.split(',')[0],
      lat: item.lat,
      lng: item.lng,
    };

    if (waypoints.length > 0) {
      const remaining = waypoints.slice(0, -1);
      onSetWaypoints([...remaining, destWp]);
    } else {
      onSetWaypoints([destWp]);
    }
  };

  const useCurrentLocationAsStart = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const startWp: Waypoint = {
          id: 'start',
          name: 'Mein Standort',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setStartQuery('Mein Standort');
        if (waypoints.length > 1) {
          onSetWaypoints([startWp, ...waypoints.slice(1)]);
        } else {
          onSetWaypoints([startWp]);
        }
      },
      (err) => {
        alert('Standortzugriff nicht möglich: ' + err.message);
      }
    );
  };

  return (
    <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 text-slate-100 shadow-2xl border border-slate-800 space-y-4">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-indigo-400" />
          <h2 className="font-semibold text-sm sm:text-base text-slate-100">Routen-Planer</h2>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-800 p-1 rounded-lg text-xs font-medium">
          <button
            onClick={() => {
              setPlannerTab('standard');
              if (isDesignMode) onToggleDesignMode();
            }}
            className={`px-3 py-1 rounded-md transition-all ${
              plannerTab === 'standard'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Start & Ziel
          </button>
          <button
            onClick={() => setPlannerTab('custom')}
            className={`px-3 py-1 rounded-md transition-all ${
              plannerTab === 'custom'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Eigene Route
          </button>
        </div>
      </div>

      {/* Travel mode buttons (walking, cycling, driving) */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">Fortbewegung:</span>
        <div className="flex gap-1.5 bg-slate-800/80 p-1 rounded-lg">
          <button
            onClick={() => onTravelModeChange('walking')}
            title="Zu Fuß / Laufen"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md font-medium transition ${
              travelMode === 'walking'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Footprints className="w-3.5 h-3.5" />
            Laufen
          </button>
          <button
            onClick={() => onTravelModeChange('cycling')}
            title="Fahrrad"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md font-medium transition ${
              travelMode === 'cycling'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            Rad
          </button>
          <button
            onClick={() => onTravelModeChange('driving')}
            title="Fahrzeug"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md font-medium transition ${
              travelMode === 'driving'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            Auto
          </button>
        </div>
      </div>

      {/* Mode 1: Standard Start & Destination */}
      {plannerTab === 'standard' && (
        <div className="space-y-3">
          {/* Start Input */}
          <div className="relative">
            <div className="flex items-center bg-slate-800 rounded-xl px-3 py-2 border border-slate-700 focus-within:border-indigo-500">
              <span className="w-3 h-3 rounded-full bg-emerald-500 mr-2.5 flex-shrink-0" />
              <input
                type="text"
                placeholder="Startadresse suchen..."
                value={startQuery}
                onChange={(e) => handleStartSearch(e.target.value)}
                className="bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none w-full"
              />
              <button
                onClick={useCurrentLocationAsStart}
                title="Meinen aktuellen GPS-Standort als Start nutzen"
                className="text-slate-400 hover:text-indigo-400 p-1 transition"
              >
                <LocateFixed className="w-4 h-4" />
              </button>
            </div>

            {/* Start Search Dropdown */}
            {startResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 rounded-xl border border-slate-700 shadow-2xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-700/50">
                {startResults.map((item) => (
                  <button
                    key={item.placeId}
                    onClick={() => selectStartPlace(item)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/80 transition flex items-start gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Destination Input */}
          <div className="relative">
            <div className="flex items-center bg-slate-800 rounded-xl px-3 py-2 border border-slate-700 focus-within:border-indigo-500">
              <span className="w-3 h-3 rounded-full bg-rose-500 mr-2.5 flex-shrink-0" />
              <input
                type="text"
                placeholder="Zieladresse suchen..."
                value={destQuery}
                onChange={(e) => handleDestSearch(e.target.value)}
                className="bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none w-full"
              />
            </div>

            {/* Destination Search Dropdown */}
            {destResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 rounded-xl border border-slate-700 shadow-2xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-700/50">
                {destResults.map((item) => (
                  <button
                    key={item.placeId}
                    onClick={() => selectDestPlace(item)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/80 transition flex items-start gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 text-rose-400 mt-0.5 flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode 2: Custom Multi-point Route Design */}
      {plannerTab === 'custom' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={onToggleDesignMode}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                isDesignMode
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              {isDesignMode ? 'Klick-Modus: Aktiv' : 'Punkte auf Karte setzen'}
            </button>

            {waypoints.length > 1 && (
              <button
                onClick={onReverseRoute}
                title="Route umkehren"
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs flex items-center gap-1 transition"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                Umkehren
              </button>
            )}
          </div>

          {/* Waypoints list */}
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {waypoints.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 bg-slate-800/40 rounded-xl border border-dashed border-slate-700">
                Klicke auf die Karte oder aktiviere den Klick-Modus, um Wegpunkte für deine Route hinzuzufügen.
              </div>
            ) : (
              waypoints.map((wp, idx) => (
                <div
                  key={wp.id}
                  className="flex items-center justify-between bg-slate-800/70 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg text-xs border border-slate-700/60"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-white ${
                        idx === 0
                          ? 'bg-emerald-500'
                          : idx === waypoints.length - 1
                          ? 'bg-rose-500'
                          : 'bg-indigo-600'
                      }`}
                    >
                      {idx === 0 ? 'S' : idx === waypoints.length - 1 ? 'Z' : idx + 1}
                    </span>
                    <span className="truncate text-slate-200">
                      {wp.name || `Punkt ${idx + 1} (${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)})`}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemoveWaypoint(wp.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 transition ml-1 flex-shrink-0"
                    title="Punkt entfernen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Summary info bar */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
        <div className="text-slate-400">
          Distanz:{' '}
          <span className="font-semibold text-slate-200">
            {totalDistanceMeters > 0
              ? totalDistanceMeters >= 1000
                ? `${(totalDistanceMeters / 1000).toFixed(2)} km`
                : `${Math.round(totalDistanceMeters)} m`
              : 'Keine Route'}
          </span>
        </div>
        {isLoading && (
          <div className="flex items-center gap-1.5 text-indigo-400 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            Berechne Route...
          </div>
        )}
      </div>
    </div>
  );
};
