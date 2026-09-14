import type { PacerStatus, UserTrackingStatus } from '../types/route';
import { formatDuration, formatDistance } from '../services/geoMath';
import { Gauge, Flag, Hourglass, Navigation, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface PacerStatsProps {
  pacerStatus: PacerStatus;
  userTracking: UserTrackingStatus;
  isGpsEnabled: boolean;
  onToggleGps: () => void;
  gpsError: string | null;
}

export const PacerStats = ({
  pacerStatus,
  userTracking,
  isGpsEnabled,
  onToggleGps,
  gpsError,
}: PacerStatsProps) => {
  const {
    progress,
    requiredSpeedKmH,
    remainingDistanceMeters,
    remainingTimeSeconds,
    isFinished,
    hasStarted,
  } = pacerStatus;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 text-slate-100 shadow-2xl border border-slate-800 space-y-3">
      {/* Top Header & Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isFinished
                ? 'bg-emerald-400 animate-pulse'
                : hasStarted
                ? 'bg-amber-400 animate-ping'
                : 'bg-slate-500'
            }`}
          />
          <span className="font-semibold text-sm">
            {isFinished
              ? 'Ziel erreicht!'
              : hasStarted
              ? 'Idealpunkt läuft...'
              : 'Wartet auf Startzeit...'}
          </span>
        </div>

        {/* GPS Button */}
        <button
          onClick={onToggleGps}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition border ${
            isGpsEnabled
              ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 shadow-sm'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
          }`}
        >
          <Navigation className={`w-3.5 h-3.5 ${isGpsEnabled ? 'text-blue-400 animate-pulse' : ''}`} />
          {isGpsEnabled ? 'GPS Aktiv' : 'GPS Einschalten'}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Fortschritt</span>
          <span className="font-mono font-medium text-amber-400">
            {(progress * 100).toFixed(1)}%
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-800/80 p-2 rounded-xl text-center border border-slate-700/60">
          <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
            <Hourglass className="w-3 h-3 text-amber-400" />
            Restzeit
          </div>
          <div className="text-xs sm:text-sm font-bold font-mono text-slate-100 mt-0.5">
            {formatDuration(remainingTimeSeconds)}
          </div>
        </div>

        <div className="bg-slate-800/80 p-2 rounded-xl text-center border border-slate-700/60">
          <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
            <Flag className="w-3 h-3 text-rose-400" />
            Reststrecke
          </div>
          <div className="text-xs sm:text-sm font-bold font-mono text-slate-100 mt-0.5">
            {formatDistance(remainingDistanceMeters)}
          </div>
        </div>

        <div className="bg-slate-800/80 p-2 rounded-xl text-center border border-slate-700/60">
          <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
            <Gauge className="w-3 h-3 text-indigo-400" />
            Pacer-Tempo
          </div>
          <div className="text-xs sm:text-sm font-bold font-mono text-slate-100 mt-0.5">
            {requiredSpeedKmH.toFixed(1)} km/h
          </div>
        </div>
      </div>

      {/* Ghost Runner GPS comparison */}
      {isGpsEnabled && (
        <div className="pt-1">
          {userTracking.position && userTracking.distanceToPacerMeters !== null ? (
            <div
              className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                userTracking.aheadOrBehind === 'ahead'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : userTracking.aheadOrBehind === 'behind'
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <div>
                {userTracking.aheadOrBehind === 'ahead' ? (
                  <span>
                    Du liegst <strong>{Math.round(userTracking.distanceToPacerMeters)}m</strong> VOR dem Idealpunkt! Super Tempo!
                  </span>
                ) : userTracking.aheadOrBehind === 'behind' ? (
                  <span>
                    Du liegst <strong>{Math.round(userTracking.distanceToPacerMeters)}m</strong> HINTER dem Idealpunkt! Gib Gas!
                  </span>
                ) : (
                  <span>Du bist exakt gleichauf mit dem Idealpunkt!</span>
                )}
                {userTracking.speedKmH !== null && (
                  <span className="block text-[11px] opacity-80 mt-0.5">
                    Deine aktuelle Geschwindigkeit: {userTracking.speedKmH.toFixed(1)} km/h
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 bg-slate-800/40 p-2 rounded-xl text-center animate-pulse">
              Warte auf GPS-Signal...
            </div>
          )}
        </div>
      )}

      {gpsError && (
        <div className="text-xs text-rose-400 bg-rose-950/30 p-2 rounded-xl border border-rose-800/40 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}
    </div>
  );
};
