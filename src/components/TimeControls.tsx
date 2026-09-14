import type { TimeConfig } from '../types/route';
import { Clock, RotateCcw, Zap } from 'lucide-react';

interface TimeControlsProps {
  timeConfig: TimeConfig;
  onTimeConfigChange: (config: TimeConfig) => void;
  onResetToNow: () => void;
  requiredSpeedKmH: number;
  paceMinPerKm: number;
}

export const TimeControls = ({
  timeConfig,
  onTimeConfigChange,
  onResetToNow,
  requiredSpeedKmH,
  paceMinPerKm,
}: TimeControlsProps) => {
  // Add quick minutes to target time
  const addQuickMinutes = (mins: number) => {
    const base = new Date();
    if (timeConfig.startMode === 'custom' && timeConfig.startTime) {
      const parts = timeConfig.startTime.split(':').map(Number);
      if (parts.length >= 2) {
        base.setHours(parts[0], parts[1], parts[2] || 0, 0);
      }
    }
    const target = new Date(base.getTime() + mins * 60 * 1000);
    const hh = target.getHours().toString().padStart(2, '0');
    const mm = target.getMinutes().toString().padStart(2, '0');
    onTimeConfigChange({
      ...timeConfig,
      targetTime: `${hh}:${mm}`,
    });
  };

  return (
    <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 text-slate-100 shadow-2xl border border-slate-800 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          <h2 className="font-semibold text-sm sm:text-base text-slate-100">Zeit & Pacer-Planung</h2>
        </div>
        <span className="text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
          Zielminute :00
        </span>
      </div>

      {/* Startzeit Configuration */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400">Startzeit:</label>
          <div className="flex bg-slate-800 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => {
                const now = new Date();
                const hh = now.getHours().toString().padStart(2, '0');
                const mm = now.getMinutes().toString().padStart(2, '0');
                const ss = now.getSeconds().toString().padStart(2, '0');
                onTimeConfigChange({
                  ...timeConfig,
                  startMode: 'now',
                  startTime: `${hh}:${mm}:${ss}`,
                });
              }}
              className={`px-2.5 py-1 rounded-md transition ${
                timeConfig.startMode === 'now'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Aktuelle Zeit (Jetzt)
            </button>
            <button
              onClick={() =>
                onTimeConfigChange({
                  ...timeConfig,
                  startMode: 'custom',
                })
              }
              className={`px-2.5 py-1 rounded-md transition ${
                timeConfig.startMode === 'custom'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Manuell
            </button>
          </div>
        </div>

        {timeConfig.startMode === 'custom' ? (
          <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2 border border-slate-700">
            <Clock className="w-4 h-4 text-slate-400" />
            <input
              type="time"
              step="1"
              value={timeConfig.startTime}
              onChange={(e) =>
                onTimeConfigChange({
                  ...timeConfig,
                  startTime: e.target.value,
                })
              }
              className="bg-transparent text-sm text-slate-100 focus:outline-none w-full font-mono"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between bg-slate-800/60 rounded-xl px-3 py-2 border border-slate-700/50 text-xs text-slate-300">
            <span>Live gestartet um: <strong className="font-mono text-amber-300">{timeConfig.startTime || 'Jetzt'}</strong></span>
            <button
              onClick={onResetToNow}
              title="Startzeitpunkt auf genau jetzt zurücksetzen"
              className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium bg-amber-500/10 px-2 py-0.5 rounded-md hover:bg-amber-500/20 transition"
            >
              <RotateCcw className="w-3 h-3" />
              Jetzt neu setzen
            </button>
          </div>
        )}
      </div>

      {/* Zielzeit Configuration */}
      <div className="space-y-2">
        <label className="text-xs text-slate-400">
          Zielzeit (Erreicht bei Beginn der Minute :00):
        </label>
        <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2 border border-slate-700 focus-within:border-amber-500">
          <Clock className="w-4 h-4 text-amber-400" />
          <input
            type="time"
            value={timeConfig.targetTime}
            onChange={(e) =>
              onTimeConfigChange({
                ...timeConfig,
                targetTime: e.target.value,
              })
            }
            className="bg-transparent text-sm text-slate-100 focus:outline-none w-full font-mono font-semibold"
          />
        </div>

        {/* Quick add time buttons */}
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-[11px] text-slate-500 flex items-center gap-1 mr-1">
            <Zap className="w-3 h-3 text-amber-400" /> Schnellwahl:
          </span>
          {[5, 15, 30, 60].map((mins) => (
            <button
              key={mins}
              onClick={() => addQuickMinutes(mins)}
              className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2 py-0.5 rounded-md border border-slate-700 transition"
            >
              +{mins}m
            </button>
          ))}
        </div>
      </div>

      {/* Required Speed / Pace preview */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
        <div className="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/60">
          <div className="text-[11px] text-slate-400">Soll-Geschwindigkeit</div>
          <div className="text-base font-bold text-amber-400 font-mono">
            {requiredSpeedKmH > 0 ? `${requiredSpeedKmH.toFixed(1)} km/h` : '--'}
          </div>
        </div>
        <div className="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/60">
          <div className="text-[11px] text-slate-400">Soll-Pace</div>
          <div className="text-base font-bold text-amber-400 font-mono">
            {paceMinPerKm > 0 && isFinite(paceMinPerKm)
              ? `${Math.floor(paceMinPerKm)}:${Math.round((paceMinPerKm % 1) * 60)
                  .toString()
                  .padStart(2, '0')} min/km`
              : '--:--'}
          </div>
        </div>
      </div>
    </div>
  );
};
