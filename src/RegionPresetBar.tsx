import type { RegionKey } from './OceanGlobeViewer';

interface RegionPresetBarProps {
  activeRegion: RegionKey;
  onSelectRegion: (region: RegionKey) => void;
}

export default function RegionPresetBar({ activeRegion, onSelectRegion }: RegionPresetBarProps) {
  const regions: { key: RegionKey; label: string }[] = [
    { key: 'INDIAN_OCEAN', label: 'Indian Ocean' },
    { key: 'ARABIAN_SEA', label: 'Arabian Sea' },
    { key: 'BAY_OF_BENGAL', label: 'Bay of Bengal' },
  ];

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-700/60 shadow-lg p-1">
      {regions.map((region) => (
        <button
          key={region.key}
          onClick={() => onSelectRegion(region.key)}
          className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-300 border ${
            activeRegion === region.key
              ? 'bg-[#38bdf8]/20 border-[#38bdf8] text-[#38bdf8] shadow-[0_0_10px_rgba(56,189,248,0.2)]'
              : 'border-transparent text-slate-300 hover:text-white hover:border-cyan-500/50'
          }`}
        >
          {region.label}
        </button>
      ))}
    </div>
  );
}
