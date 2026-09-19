import './App.css';
import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Globe2, RotateCcw, 
  Layers, Settings, Activity, AlertTriangle,
  Thermometer, Droplets, Compass, Sparkles, Wind
} from 'lucide-react';
import OceanGlobeViewer, { type OceanGlobeRef, type RegionKey } from './OceanGlobeViewer';
import RegionPresetBar from './RegionPresetBar';
import { ScientificColorbar } from './components/ScientificColorbar';
import { VerticalProfileChart } from './components/VerticalProfileChart';
import { TimelineController } from './components/TimelineController';
import { OutreachPanel, type TourStory } from './components/OutreachPanel';
import { PublicTooltipOverlay } from './components/PublicTooltipOverlay';
import { type ColormapName } from './utils/colormaps';
import { 
  fetchVariables, 
  fetchMetadata, 
  fetchObservations, 
  fetchObservationProfile, 
  fetchComparison, 
  fetchInsight,
  type Variable,
  type ModelMetadata,
  type ObservationSummary,
  type ObservationProfile,
  type DataComparison,
  type Insight
} from './services/api';

export default function App() {
  const globeRef = useRef<OceanGlobeRef>(null);
  
  // State
  const [personaMode, setPersonaMode] = useState<'operational' | 'outreach'>('operational');
  const [activeStoryId, setActiveStoryId] = useState<string>('bob-river-plume');
  const [activeRegion, setActiveRegion] = useState<RegionKey>('INDIAN_OCEAN');
  const [activeVar, setActiveVar] = useState('temperature');
  const [depth, setDepth] = useState(100);
  const [layers, setLayers] = useState({ model: true, argo: true, gliders: true, currents: true });
  const [isPlaying, setIsPlaying] = useState(false);
  const [dateIndex, setDateIndex] = useState(7);
  const [verticalExaggeration, setVerticalExaggeration] = useState(250);
  
  // Scientific Colormap & Range State
  const [colormap, setColormap] = useState<ColormapName>('thermal');
  const [minValue, setMinValue] = useState<number>(2.0);
  const [maxValue, setMaxValue] = useState<number>(32.0);
  const [isLogScale, setIsLogScale] = useState<boolean>(false);
  
  // Data State
  const [variables, setVariables] = useState<Variable[]>([]);
  const [metadata, setMetadata] = useState<ModelMetadata | null>(null);
  const [observations, setObservations] = useState<ObservationSummary[]>([]);
  const [activeObsProfile, setActiveObsProfile] = useState<ObservationProfile | null>(null);
  const [comparison, setComparison] = useState<DataComparison | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [outreachWelcomeDismissed, setOutreachWelcomeDismissed] = useState(false);

  // Derived state
  const dates = metadata?.available_timestamps || [
    "1 Sept 2026", "2 Sept 2026", "3 Sept 2026", "4 Sept 2026", "5 Sept 2026",
    "6 Sept 2026", "7 Sept 2026", "8 Sept 2026", "9 Sept 2026", "10 Sept 2026"
  ];
  const activeObs = !!activeObsProfile;
  const activeVarObj = useMemo(() => {
    return variables.find(v => v.id === activeVar) || { id: activeVar, name: activeVar, unit: '°C' };
  }, [variables, activeVar]);

  // Initialization
  useEffect(() => {
    async function init() {
      try {
        const [vars, meta, obs] = await Promise.all([
          fetchVariables(),
          fetchMetadata(),
          fetchObservations()
        ]);
        setVariables(vars);
        setMetadata(meta);
        setObservations(obs);

        // Showcase State initialization
       const defaultObs = obs[0];
        if (defaultObs) {
          const profile = await fetchObservationProfile(defaultObs.id);
          setActiveObsProfile(profile);
        }
      } catch (e) {
        console.error("Failed to fetch initial data", e);
      }
    }
    init();
  }, []);

  // Update comparison when depth/var/time changes for active observation
  useEffect(() => {
    async function updateComparison() {
      if (activeObsProfile) {
        try {
          const comp = await fetchComparison(activeObsProfile.id, activeVar, depth);
          setComparison(comp);
          const ins = await fetchInsight(activeObsProfile.id, depth);
          setInsight(ins);
        } catch (e) {
          console.error("Failed to fetch comparison or insight", e);
          setComparison(null);
          setInsight(null);
        }
      } else {
        setComparison(null);
        setInsight(null);
      }
    }
    updateComparison();
  }, [activeObsProfile, activeVar, depth, dateIndex]);

  const handleRegionSelect = (region: RegionKey) => {
    setActiveRegion(region);
    globeRef.current?.flyToRegion(region);
  };

  const handleObservationSelect = async (obs: ObservationSummary) => {
    try {
      const profile = await fetchObservationProfile(obs.id);
      setActiveObsProfile(profile);
      globeRef.current?.focusObservation(obs.latitude, obs.longitude);
      setActiveRegion('ARABIAN_SEA'); // Just indicative
    } catch (e) {
      console.error(e);
    }
  };

  const handleStorySelect = (story: TourStory) => {
    setActiveStoryId(story.id);
    setActiveRegion(story.region);
    setActiveVar(story.variable);
    setDepth(story.depth);
    if (story.variable === 'salinity') {
      setColormap('haline');
      setMinValue(30.0);
      setMaxValue(37.0);
    } else if (story.variable === 'chlorophyll') {
      setColormap('algae');
      setMinValue(0.01);
      setMaxValue(5.0);
    } else if (story.variable === 'dissolved_oxygen') {
      setColormap('dense');
      setMinValue(0.0);
      setMaxValue(6.0);
    } else if (story.variable === 'temperature') {
      setColormap('thermal');
      setMinValue(2.0);
      setMaxValue(32.0);
    }
    globeRef.current?.flyToRegion(story.region);
  };

  const resetView = () => {
    setActiveRegion('INDIAN_OCEAN');
    setActiveObsProfile(null);
    setComparison(null);
    setInsight(null);
    globeRef.current?.flyToRegion('INDIAN_OCEAN');
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020610] text-slate-100 font-sans selection:bg-[#38bdf8] selection:text-white">
      
      <OceanGlobeViewer 
        ref={globeRef} 
        observations={observations}
        onObservationSelect={handleObservationSelect}
        activeObservationId={activeObsProfile?.id || null}
        activeVar={activeVar}
        depth={depth}
        timestamp={dates[dateIndex] || "2026-09-08T12:00:00"}
        showModelLayer={layers.model}
        showArgoLayer={layers.argo}
        showGlidersLayer={layers.gliders}
        showCurrentsLayer={layers.currents}
        verticalExaggeration={verticalExaggeration}
        comparison={comparison}
      />
      
      <RegionPresetBar activeRegion={activeRegion} onSelectRegion={handleRegionSelect} />

      {/* TOP HEADER BAR WITH DUAL-PERSONA SWITCHER */}
      <header className="absolute top-0 inset-x-0 h-14 z-20 flex items-center justify-between px-6 bg-slate-950/85 border-b border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[#38bdf8]">
            <Activity className="w-5 h-5" />
            <h1 className="text-base font-black tracking-wide text-white">INCOIS 3D OCEAN TWIN</h1>
          </div>
          <div className="h-4 w-px bg-slate-800"></div>
          <p className="text-xs text-slate-400 font-medium hidden md:block">Interactive Ocean Model & In-Situ Observation Platform</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Persona Mode Switcher */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-full border border-slate-700 shadow-inner">
            <button
              onClick={() => setPersonaMode('operational')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full transition-all ${
                personaMode === 'operational'
                  ? 'bg-[#0284c7] text-white shadow-[0_0_12px_rgba(2,132,199,0.5)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Operational Mode</span>
            </button>
            <button
              onClick={() => setPersonaMode('outreach')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full transition-all ${
                personaMode === 'outreach'
                  ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Public Outreach Tour</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>

          <div className="text-xs font-mono text-slate-300 hidden sm:block">
            {dates[dateIndex] ? new Date(dates[dateIndex]).toLocaleDateString('en-GB') : ''}, 12:00 UTC
          </div>

          <button 
            onClick={resetView}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </header>

      {/* CONDITIONAL PANELS BASED ON PERSONA MODE */}
      {personaMode === 'operational' ? (
        <>
          {/* LEFT OPERATIONAL CONTROL PANEL */}
          <aside className="absolute top-20 left-6 w-84 z-10 flex flex-col gap-3.5 pointer-events-auto">
            {/* Controls Card */}
            <div className="op-card rounded-xl p-4 shadow-2xl flex flex-col gap-4">
              
              {/* Dense Variable Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-[#38bdf8]" /> Ocean Variable
                  </h3>
                  <span className="text-[10px] font-mono text-[#38bdf8] font-bold uppercase bg-[#38bdf8]/10 px-2 py-0.5 rounded border border-[#38bdf8]/30">
                    {activeVarObj?.unit || ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {variables.map((v) => {
                    const isSelected = activeVar === v.id;
                    const IconComponent = v.id === 'temperature' ? Thermometer :
                      v.id === 'salinity' ? Droplets :
                      v.id === 'chlorophyll' ? Sparkles :
                      v.id === 'dissolved_oxygen' ? Wind : Compass;

                    return (
                      <button
                        key={v.id}
                        onClick={() => {
                          setActiveVar(v.id);
                          if (v.id === 'temperature') {
                            setColormap('thermal');
                            setMinValue(2.0);
                            setMaxValue(32.0);
                          } else if (v.id === 'salinity') {
                            setColormap('haline');
                            setMinValue(30.0);
                            setMaxValue(37.0);
                          } else if (v.id.includes('current')) {
                            setColormap('balance');
                            setMinValue(-1.5);
                            setMaxValue(1.5);
                          } else if (v.id === 'chlorophyll') {
                            setColormap('algae');
                            setMinValue(0.01);
                            setMaxValue(5.0);
                          } else if (v.id === 'dissolved_oxygen') {
                            setColormap('dense');
                            setMinValue(0.0);
                            setMaxValue(6.0);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-all border text-left ${
                          isSelected
                            ? 'bg-[#0284c7] text-white border-cyan-400 shadow-md font-semibold'
                            : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/80'
                        }`}
                      >
                        <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                        <span className="truncate">{v.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Depth Control */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#38bdf8]" /> Vertical Depth Slicing
                  </h3>
                  <span className="text-xs font-mono bg-[#38bdf8]/10 text-[#38bdf8] px-2 py-0.5 rounded border border-[#38bdf8]/20 font-bold">
                    {depth}m
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" max="2000" step="50"
                  value={depth}
                  onChange={(e) => setDepth(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1 px-0.5">
                  <span>0m (Surface)</span>
                  <span>100m</span>
                  <span>500m</span>
                  <span>1000m</span>
                  <span>2000m</span>
                </div>
              </div>

              {/* Vertical Exaggeration Control */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#38bdf8]" /> 3D Depth Exaggeration
                  </h3>
                  <span className="text-xs font-mono bg-[#38bdf8]/10 text-[#38bdf8] px-2 py-0.5 rounded border border-[#38bdf8]/20 font-bold">
                    {verticalExaggeration}×
                  </span>
                </div>
                <input 
                  type="range" 
                  min="50" max="600" step="25"
                  value={verticalExaggeration}
                  onChange={(e) => setVerticalExaggeration(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1 px-0.5">
                  <span>50×</span>
                  <span>250× (Nominal)</span>
                  <span>600×</span>
                </div>
              </div>

              {/* Layer Toggles */}
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Operational Data Layers</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  <LayerToggle 
                    label="Model Grid" 
                    active={layers.model} 
                    onChange={() => setLayers(l => ({ ...l, model: !l.model }))} 
                  />
                  <LayerToggle 
                    label="Argo (3D)" 
                    active={layers.argo} 
                    onChange={() => setLayers(l => ({ ...l, argo: !l.argo }))} 
                  />
                  <LayerToggle 
                    label="Gliders (3D)" 
                    active={layers.gliders} 
                    onChange={() => setLayers(l => ({ ...l, gliders: !l.gliders }))} 
                  />
                  <LayerToggle 
                    label="Current Vectors" 
                    active={layers.currents} 
                    onChange={() => setLayers(l => ({ ...l, currents: !l.currents }))} 
                  />
                </div>
              </div>
            </div>

            {/* Scientific Colorbar */}
            <ScientificColorbar
              variableId={activeVar}
              variableName={activeVarObj?.name || activeVar}
              unit={activeVarObj?.unit || ''}
              colormap={colormap}
              onColormapChange={setColormap}
              minValue={minValue}
              maxValue={maxValue}
              onMinChange={setMinValue}
              onMaxChange={setMaxValue}
              isLogScale={isLogScale}
              onLogScaleToggle={() => setIsLogScale(!isLogScale)}
            />
          </aside>
        </>
      ) : (
        /* PUBLIC SCIENCE OUTREACH MODE */
        <aside className="absolute top-20 left-6 z-10 pointer-events-auto flex flex-col gap-3 outreach-aside">
          {/* One-time dismissible Welcome Banner */}
          {!outreachWelcomeDismissed && (
            <div
              className="op-card rounded-2xl p-4 max-w-sm border border-emerald-500/40 shadow-2xl flex flex-col gap-2.5"
              style={{ animation: 'fadeSlideUp 0.5s ease-out both' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 mb-0.5">Public Science Outreach Mode</p>
                  <h2 className="text-sm font-black text-white leading-snug">Explore the Indian Ocean Like Never Before</h2>
                </div>
                <button
                  onClick={() => setOutreachWelcomeDismissed(true)}
                  className="shrink-0 text-slate-500 hover:text-white text-lg leading-none font-bold mt-0.5 transition-colors"
                  aria-label="Dismiss welcome banner"
                >
                  ×
                </button>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Use the guided tour cards below to fly through four landmark Indian Ocean phenomena —
                each explained in plain language for students, educators, and science enthusiasts.
              </p>
              <button
                onClick={() => setOutreachWelcomeDismissed(true)}
                className="text-xs font-bold text-emerald-400 text-left hover:text-emerald-300 transition-colors"
              >
                Start Exploring →
              </button>
            </div>
          )}

          <OutreachPanel
            onSelectStory={handleStorySelect}
            activeStoryId={activeStoryId}
          />

          {/* Layman parameter tooltip */}
          <PublicTooltipOverlay
            activeVar={activeVar}
            activeStoryId={activeStoryId}
          />
        </aside>
      )}

      {/* RIGHT ANALYSIS PANEL (OPERATIONAL PERSONA ONLY) */}
      {personaMode === 'operational' && (
      <aside className="absolute top-20 right-6 w-96 z-10 pointer-events-auto">
        <div className="op-card rounded-xl shadow-2xl overflow-hidden transition-all duration-300 min-h-[300px] flex flex-col">
          
          {!activeObs ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-70">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center mb-4">
                <Globe2 className="w-8 h-8 text-[#38bdf8]" />
              </div>
              <h3 className="text-sm font-bold text-slate-200 mb-1.5 uppercase tracking-wider">No Platform Selected</h3>
              <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
                Click an Argo Float or Glider on the 3D globe to inspect depth profiles and compare against numerical model forecasts.
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b border-slate-700/60 bg-slate-950/60">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[9px] uppercase tracking-widest font-bold text-slate-500 mb-1">
                      {activeObsProfile?.type === 'argo_float' ? 'ARGO PROFILING PLATFORM' : 'AUTONOMOUS GLIDER'}
                    </div>
                    <h2 className="text-base font-black text-white font-mono flex items-center gap-2">
                      {activeObsProfile?.id}
                    </h2>
                    <p className="text-[10px] text-[#38bdf8] font-mono mt-0.5">{activeObsProfile?.sensor || 'Multi-Parameter CTD'}</p>
                  </div>
                  
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
                      Active In-Situ
                    </span>
                    <div className="text-[10px] font-mono text-slate-400 mt-1">
                      {activeObsProfile?.latitude}°N, {activeObsProfile?.longitude}°E
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex flex-col gap-3.5 max-h-[calc(100vh-220px)] overflow-y-auto">
                
                {/* Professional Inverted Y-Axis Recharts Profile Chart */}
                {activeObsProfile && (
                  <VerticalProfileChart
                    profile={activeObsProfile}
                    activeVar={activeVar}
                    unit={activeVarObj?.unit || ''}
                    selectedDepth={depth}
                  />
                )}

                {/* Model vs Observation Statistical Validation Card */}
                {comparison ? (
                  <div className="bg-slate-950/90 rounded-xl border border-slate-800 p-3 flex flex-col gap-2.5">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                        Model vs Observation @ {depth}m
                      </h4>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                        comparison.severity === 'significant' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                        comparison.severity === 'moderate' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                        'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {comparison.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center divide-x divide-slate-800 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                      <div>
                        <div className="text-[9px] text-slate-400 uppercase">Model Val</div>
                        <div className="text-xs font-mono font-bold text-slate-200 mt-0.5">
                          {comparison.model_value} {comparison.unit}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-400 uppercase">Observed</div>
                        <div className="text-xs font-mono font-bold text-[#38bdf8] mt-0.5">
                          {comparison.observed_value} {comparison.unit}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-400 uppercase">Δ Discrepancy</div>
                        <div className={`text-xs font-mono font-bold mt-0.5 ${
                          comparison.severity === 'significant' ? 'text-red-400' : 'text-slate-200'
                        }`}>
                          {comparison.difference > 0 ? '+' : ''}{comparison.difference} {comparison.unit}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-1">
                      <span>Column Profile RMSE: <strong className="text-white">{comparison.column_rmse}</strong></span>
                      <span>Confidence: <strong className="text-[#10b981]">{(comparison.confidence_score * 100).toFixed(0)}%</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 text-center text-xs text-slate-400">
                    Calculating model interpolation for {depth}m depth...
                  </div>
                )}

                {/* Oceanographic Anomaly Insight */}
                {insight && (
                  <div className="bg-slate-950/90 border border-cyan-500/30 rounded-xl p-3 flex flex-col gap-2 shadow-lg">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#38bdf8] uppercase tracking-wider">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Oceanographic Anomaly Analysis</span>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed">
                      {insight.message}
                    </p>

                    <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-2 leading-relaxed">
                      <span className="text-slate-500 font-bold uppercase text-[9px] block mb-0.5">Diagnostic Interpretation:</span>
                      {insight.explanation}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
      )}

      {/* BOTTOM TIMELINE & 4D SCRUBBER */}
      <div className="absolute bottom-6 inset-x-0 flex justify-center z-20 pointer-events-none">
        <div className="pointer-events-auto">
          <TimelineController
            dates={dates}
            dateIndex={dateIndex}
            onDateIndexChange={setDateIndex}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
          />
        </div>
      </div>
      
    </div>
  );
}

// Helper component for layer toggles
function LayerToggle({ label, active, onChange, disabled = false }: { label: string, active: boolean, onChange?: () => void, disabled?: boolean }) {
  return (
    <label
  onClick={disabled ? undefined : onChange}
  className={`flex items-center justify-between p-2 rounded-lg border ${
    active
      ? 'bg-slate-800/80 border-slate-600'
      : 'bg-slate-800/30 border-transparent hover:bg-slate-800/50'
  } ${
    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
  } transition-all`}
>
      <div className="flex items-center gap-2">
        <div className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center border ${active ? 'bg-[#38bdf8] border-[#38bdf8]' : 'border-slate-500'}`}>
          {active && <svg className="w-2.5 h-2.5 text-[#0a1322]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
        </div>
        <span className="text-xs font-medium text-slate-300">{label}</span>
      </div>
      {disabled && (
        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">Coming Soon</span>
      )}
    </label>
  );
}
