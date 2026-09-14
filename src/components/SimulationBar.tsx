import React from 'react';
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react';

interface SimulationBarProps {
  isSimulating: boolean;
  onToggleSimulating: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  progress: number;
  onScrub: (progress: number) => void;
  onReset: () => void;
  multiplier: number;
  onMultiplierChange: (mult: number) => void;
}

export const SimulationBar: React.FC<SimulationBarProps> = ({
  isSimulating,
  onToggleSimulating,
  isPlaying,
  onTogglePlay,
  progress,
  onScrub,
  onReset,
  multiplier,
  onMultiplierChange,
}) => {
  const speeds = [1, 5, 15, 30, 60];

  return (
    <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl p-3 text-slate-100 shadow-2xl border border-slate-800 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FastForward className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-200">
            Zeitraffer & Simulation
          </span>
        </div>

        <button
          onClick={onToggleSimulating}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition border ${
            isSimulating
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
          }`}
        >
          {isSimulating ? 'Simulationsmodus aktiv' : 'Simulation testen'}
        </button>
      </div>

      {isSimulating && (
        <div className="space-y-2 pt-1 border-t border-slate-800">
          {/* Progress scrubber */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-mono w-8">
              {Math.round(progress * 100)}%
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={progress}
              onChange={(e) => onScrub(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Controls: Play/Pause, Reset, Speed multipliers */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                onClick={onTogglePlay}
                className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
                title={isPlaying ? 'Pause' : 'Start'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={onReset}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                title="Zurück zum Start"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Speed Multipliers */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-lg">
              {speeds.map((s) => (
                <button
                  key={s}
                  onClick={() => onMultiplierChange(s)}
                  className={`px-2 py-0.5 text-[11px] rounded font-mono font-medium transition ${
                    multiplier === s
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
