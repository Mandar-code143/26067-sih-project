import React, { useEffect } from 'react';
import { Play, Pause, StepBack, StepForward, Clock } from 'lucide-react';

interface TimelineControllerProps {
  dates: string[];
  dateIndex: number;
  onDateIndexChange: (idx: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export const TimelineController: React.FC<TimelineControllerProps> = ({
  dates,
  dateIndex,
  onDateIndexChange,
  isPlaying,
  onTogglePlay
}) => {
  const maxIndex = Math.max(0, dates.length - 1);

  // Auto-advance timeline on playback
  useEffect(() => {
    if (!isPlaying || dates.length <= 1) return;

    const timer = setInterval(() => {
      onDateIndexChange((dateIndex + 1) % dates.length);
    }, 1800);

    return () => clearInterval(timer);
  }, [isPlaying, dateIndex, dates.length, onDateIndexChange]);

  const handleStepBack = () => {
    onDateIndexChange(dateIndex > 0 ? dateIndex - 1 : maxIndex);
  };

  const handleStepForward = () => {
    onDateIndexChange(dateIndex < maxIndex ? dateIndex + 1 : 0);
  };

  const activeDateStr = dates[dateIndex] 
    ? new Date(dates[dateIndex]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';

  return (
    <div className="op-card rounded-2xl p-3 shadow-2xl flex items-center gap-5 w-full max-w-2xl border border-cyan-500/30">
      {/* Playback Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleStepBack}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          title="Previous Time Step"
        >
          <StepBack className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onTogglePlay}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 font-bold transition-all shadow-[0_0_15px_rgba(56,189,248,0.4)]"
          title={isPlaying ? "Pause Animation" : "Play 4D Time Animation"}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        <button
          onClick={handleStepForward}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          title="Next Time Step"
        >
          <StepForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrub Bar & Ticks */}
      <div className="flex-1 flex flex-col pt-1">
        <div className="relative flex items-center">
          <input
            type="range"
            min="0"
            max={maxIndex}
            value={dateIndex}
            onChange={(e) => onDateIndexChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#38bdf8] relative z-10"
          />
        </div>

        {/* Date Labels under slider */}
        <div className="flex justify-between mt-1 text-[9px] font-mono text-slate-400">
          <span>{dates[0] ? new Date(dates[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}</span>
          <span className="text-[#38bdf8] font-bold">Step {dateIndex + 1} / {dates.length}</span>
          <span>{dates[maxIndex] ? new Date(dates[maxIndex]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}</span>
        </div>
      </div>

      {/* Active Time Readout */}
      <div className="shrink-0 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-right min-w-[130px]">
        <div className="flex items-center gap-1 justify-end text-[9px] text-slate-400 font-bold uppercase tracking-wider">
          <Clock className="w-2.5 h-2.5 text-[#38bdf8]" />
          <span>Valid Time</span>
        </div>
        <div className="text-xs font-mono font-bold text-[#38bdf8]">
          {activeDateStr} 12:00 UTC
        </div>
      </div>
    </div>
  );
};
