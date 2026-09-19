import React, { useState, useEffect } from 'react';
import { 
  BookOpen, ChevronRight, ChevronLeft, Compass, 
  Waves, Fish, Wind, Eye
} from 'lucide-react';
import { type RegionKey } from '../OceanGlobeViewer';

export interface TourStory {
  id: string;
  title: string;
  subtitle: string;
  region: RegionKey;
  targetLat: number;
  targetLon: number;
  variable: string;
  depth: number;
  icon: any;
  summary: string;
  educationalNarrative: string;
  incoisImpact: string;
}

export const OUTREACH_STORIES: TourStory[] = [
  {
    id: 'bob-river-plume',
    title: 'Bay of Bengal Freshwater Plume & Cyclones',
    subtitle: 'River runoff capping and super-cyclone fuel',
    region: 'BAY_OF_BENGAL',
    targetLat: 19.5,
    targetLon: 88.5,
    variable: 'salinity',
    depth: 0,
    icon: Waves,
    summary: 'Massive discharge from the Ganges-Brahmaputra river system forms a freshwater layer on top of the salty Bay of Bengal.',
    educationalNarrative: 'Fresh water is lighter than salt water, creating a buoyant "barrier layer" that prevents the ocean from mixing vertically. This traps solar heat at the very surface, creating ocean warm pools that supercharge tropical cyclones and monsoons over India.',
    incoisImpact: 'INCOIS monitors this barrier layer using automated Argo floats to accurately forecast cyclone intensity and coastal storm surges.'
  },
  {
    id: 'arabian-sea-salinity',
    title: 'Arabian Sea High-Salinity Evaporation Basin',
    subtitle: 'Desert winds and dense underwater currents',
    region: 'ARABIAN_SEA',
    targetLat: 18.0,
    targetLon: 64.0,
    variable: 'salinity',
    depth: 100,
    icon: Compass,
    summary: 'Arid desert winds cause immense surface evaporation, turning the northern Arabian Sea into one of the saltiest open-ocean basins on Earth.',
    educationalNarrative: 'Because the surface water loses moisture, it becomes unusually dense and heavy with salt. This salty water mass sinks beneath the surface and spreads southward across the Indian Ocean as Arabian Sea High Salinity Water (ASHSW).',
    incoisImpact: 'Numerical 3D models at INCOIS track these sinking saline currents to predict regional ocean circulation and monsoon humidity transport.'
  },
  {
    id: 'coastal-upwelling-fisheries',
    title: 'Southwest Monsoon Coastal Upwelling',
    subtitle: 'Cold nutrient injection and rich fishery zones',
    region: 'ARABIAN_SEA',
    targetLat: 10.5,
    targetLon: 74.0,
    variable: 'chlorophyll',
    depth: 50,
    icon: Fish,
    summary: 'Strong monsoon winds pull surface waters offshore, drawing up icy, nutrient-rich deep water along the Malabar and Konkan coasts.',
    educationalNarrative: 'This cold upwelling water acts like marine fertilizer, sparking massive phytoplankton blooms (marine plants) that feed sardines, mackerel, and the entire marine food chain.',
    incoisImpact: 'INCOIS generates daily Potential Fishing Zone (PFZ) advisories to guide over 500,000 Indian fishermen directly to productive marine feeding grounds, saving fuel and search time.'
  },
  {
    id: 'oxygen-minimum-zone',
    title: 'Subsurface Oxygen Minimum Zone (OMZ)',
    subtitle: 'Deep-sea breathing spaces and ocean climate health',
    region: 'BAY_OF_BENGAL',
    targetLat: 15.0,
    targetLon: 87.0,
    variable: 'dissolved_oxygen',
    depth: 300,
    icon: Wind,
    summary: 'Between 150m and 800m beneath the surface lies a vast marine zone with almost zero dissolved oxygen.',
    educationalNarrative: 'Billions of sinking microscopic marine organisms decay as they fall through the water column. Bacteria consume oxygen during decomposition, creating one of the largest naturally occurring hypoxic zones on the planet.',
    incoisImpact: 'Autonomous BGC-Argo floats and Slocum Gliders equipped with optical oxygen optodes monitor OMZ boundaries to assess marine habitat compression and greenhouse gas emissions.'
  }
];

interface OutreachPanelProps {
  onSelectStory: (story: TourStory) => void;
  activeStoryId: string;
}

export const OutreachPanel: React.FC<OutreachPanelProps> = ({
  onSelectStory,
  activeStoryId
}) => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const activeStory = OUTREACH_STORIES[currentStoryIndex];

  // Sync external activeStoryId prop to internal index
  useEffect(() => {
    const idx = OUTREACH_STORIES.findIndex(s => s.id === activeStoryId);
    if (idx !== -1 && idx !== currentStoryIndex) {
      setCurrentStoryIndex(idx);
    }
  }, [activeStoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = () => {
    const nextIdx = (currentStoryIndex + 1) % OUTREACH_STORIES.length;
    setCurrentStoryIndex(nextIdx);
    onSelectStory(OUTREACH_STORIES[nextIdx]);
  };

  const handlePrev = () => {
    const prevIdx = (currentStoryIndex - 1 + OUTREACH_STORIES.length) % OUTREACH_STORIES.length;
    setCurrentStoryIndex(prevIdx);
    onSelectStory(OUTREACH_STORIES[prevIdx]);
  };

  const handleSelectStoryIndex = (index: number) => {
    setCurrentStoryIndex(index);
    onSelectStory(OUTREACH_STORIES[index]);
  };

  const IconComponent = activeStory.icon;

  return (
    <div className="op-card rounded-2xl p-5 shadow-2xl flex flex-col gap-4 border border-emerald-500/30 max-w-md w-full">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Interactive Ocean Story Tour</h3>
            <p className="text-[10px] text-emerald-400 font-mono">Public Science Communication Mode</p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/30">
          {currentStoryIndex + 1} / {OUTREACH_STORIES.length}
        </span>
      </div>

      {/* Story Selector Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {OUTREACH_STORIES.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => handleSelectStoryIndex(idx)}
            className={`px-3 py-1 text-[10px] font-semibold rounded-full shrink-0 transition-all border ${
              idx === currentStoryIndex
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {s.title.split(' ')[0]} {s.title.split(' ')[1]}
          </button>
        ))}
      </div>

      {/* Gamified Progress Dots */}
      <div className="flex items-center justify-center gap-2">
        {OUTREACH_STORIES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => handleSelectStoryIndex(idx)}
            className={`transition-all rounded-full ${
              idx === currentStoryIndex
                ? 'w-5 h-2 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                : 'w-2 h-2 bg-slate-700 hover:bg-slate-500'
            }`}
            aria-label={`Go to story ${idx + 1}`}
          />
        ))}
      </div>

      {/* Main Educational Card */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-[#38bdf8] shrink-0 mt-0.5">
            <IconComponent className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white leading-snug">{activeStory.title}</h4>
            <p className="text-[11px] text-[#38bdf8] font-medium mt-0.5">{activeStory.subtitle}</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed font-normal">
          {activeStory.summary}
        </p>

        {/* Narrative Box */}
        <div className="bg-slate-900/80 rounded-lg p-3 border-l-2 border-emerald-400 text-xs text-slate-300 leading-relaxed">
          <span className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider block mb-1">
            Science in Action:
          </span>
          {activeStory.educationalNarrative}
        </div>

        {/* INCOIS Operational Mandate Box */}
        <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
          <span className="text-[9px] uppercase font-bold text-[#38bdf8] tracking-wider block mb-0.5">
            How INCOIS Uses This Data:
          </span>
          {activeStory.incoisImpact}
        </div>

        {/* Action Button with pulse ring */}
        <div className="relative mt-1">
          <span className="absolute inset-0 rounded-lg animate-ping bg-emerald-500 opacity-20" />
          <button
            onClick={() => onSelectStory(activeStory)}
            className="relative w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-lg transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            <Eye className="w-3.5 h-3.5" />
            Fly &amp; Explore 3D Phenomenon
          </button>
        </div>
      </div>

      {/* Next / Previous Stepper */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={handlePrev}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Previous Story
        </button>
        <button
          onClick={handleNext}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 rounded-lg transition-colors"
        >
          Next Story <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
