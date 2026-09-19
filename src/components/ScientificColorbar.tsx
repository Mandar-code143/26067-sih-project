import React from 'react';
import { Palette, ToggleLeft, ToggleRight } from 'lucide-react';
import { type ColormapName } from '../utils/colormaps';

interface ScientificColorbarProps {
  variableId: string;
  variableName: string;
  unit: string;
  colormap: ColormapName;
  onColormapChange: (cmap: ColormapName) => void;
  minValue: number;
  maxValue: number;
  onMinChange: (val: number) => void;
  onMaxChange: (val: number) => void;
  isLogScale: boolean;
  onLogScaleToggle: () => void;
}

const COLORMAP_PREVIEWS: Record<ColormapName, string> = {
  thermal: 'linear-gradient(to right, #04143c, #1c46a0, #2896d2, #f0c832, #e65a14, #be0a0a)',
  haline: 'linear-gradient(to right, #0a193c, #14648c, #1eaa82, #a0d23c, #f5eb46)',
  balance: 'linear-gradient(to right, #1e50b4, #8cbee6, #f0f0f5, #eb9678, #b41e1e)',
  algae: 'linear-gradient(to right, #0a1e3c, #145a5a, #28a550, #8cd73c, #ebf564)',
  dense: 'linear-gradient(to right, #0f0519, #3c1e6e, #287d96, #78c878, #f5f082)',
  turbo: 'linear-gradient(to right, #30123b, #4686fb, #1be5b5, #a4fc3c, #fb9b26, #7a0403)',
  viridis: 'linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725)'
};

export const ScientificColorbar: React.FC<ScientificColorbarProps> = ({
  variableName,
  unit,
  colormap,
  onColormapChange,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  isLogScale,
  onLogScaleToggle
}) => {
  return (
    <div className="op-card rounded-xl p-3.5 shadow-2xl flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider">
          <Palette className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>Scientific Colormap</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Log / Linear Toggle */}
          <button
            onClick={onLogScaleToggle}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors border ${
              isLogScale 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Toggle Logarithmic / Linear Scale Stretch"
          >
            {isLogScale ? <ToggleRight className="w-3 h-3 text-amber-400" /> : <ToggleLeft className="w-3 h-3" />}
            {isLogScale ? 'LOG10' : 'LINEAR'}
          </button>

          {/* Colormap Selector */}
          <select
            value={colormap}
            onChange={(e) => onColormapChange(e.target.value as ColormapName)}
            className="bg-slate-950 text-slate-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-slate-700 outline-none cursor-pointer"
          >
            <option value="thermal">cmocean Thermal</option>
            <option value="haline">cmocean Haline</option>
            <option value="balance">cmocean Balance (U/V)</option>
            <option value="algae">cmocean Algae (Chl)</option>
            <option value="dense">cmocean Dense (O2)</option>
            <option value="turbo">Google Turbo</option>
            <option value="viridis">Viridis</option>
          </select>
        </div>
      </div>

      {/* Active Gradient Bar */}
      <div className="relative">
        <div 
          className="h-3.5 w-full rounded-md shadow-inner border border-white/10"
          style={{ background: COLORMAP_PREVIEWS[colormap] || COLORMAP_PREVIEWS.thermal }}
        />
      </div>

      {/* Dynamic Range Min / Max Controls */}
      <div className="flex items-center justify-between gap-3 text-[11px] font-mono">
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-[10px] uppercase">Min:</span>
          <input
            type="number"
            step="0.5"
            value={minValue}
            onChange={(e) => onMinChange(Number(e.target.value))}
            className="w-16 bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded text-white text-right focus:border-[#38bdf8] outline-none"
          />
          <span className="text-slate-400 text-[10px]">{unit}</span>
        </div>

        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center truncate max-w-[120px]">
          {variableName}
        </span>

        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-[10px] uppercase">Max:</span>
          <input
            type="number"
            step="0.5"
            value={maxValue}
            onChange={(e) => onMaxChange(Number(e.target.value))}
            className="w-16 bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded text-white text-right focus:border-[#38bdf8] outline-none"
          />
          <span className="text-slate-400 text-[10px]">{unit}</span>
        </div>
      </div>
    </div>
  );
};
