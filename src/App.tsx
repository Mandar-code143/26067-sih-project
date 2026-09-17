import { useState, useRef, useEffect } from 'react';
import { 
  Globe2, RotateCcw, Play, Pause, StepForward, StepBack, 
  Layers, Settings, Activity, AlertTriangle, ChevronRight,
  Thermometer, Droplets
} from 'lucide-react';
import OceanGlobeViewer, { type OceanGlobeRef, type RegionKey } from './OceanGlobeViewer';
import RegionPresetBar from './RegionPresetBar';
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
  const [activeRegion, setActiveRegion] = useState<RegionKey>('INDIAN_OCEAN');
  const [activeVar, setActiveVar] = useState('temperature');
  const [depth, setDepth] = useState(100);
  const [layers, setLayers] = useState({ model: true, argo: true, gliders: false, currents: false });
  const [isPlaying, setIsPlaying] = useState(false);
  const [dateIndex, setDateIndex] = useState(9);
  
  // Data State
  const [variables, setVariables] = useState<Variable[]>([]);
  const [metadata, setMetadata] = useState<ModelMetadata | null>(null);
  const [observations, setObservations] = useState<ObservationSummary[]>([]);
  const [activeObsProfile, setActiveObsProfile] = useState<ObservationProfile | null>(null);
  const [comparison, setComparison] = useState<DataComparison | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);

  // Derived state
  const dates = metadata?.available_timestamps || [
    "1 Sept 2026", "2 Sept 2026", "3 Sept 2026", "4 Sept 2026", "5 Sept 2026",
    "6 Sept 2026", "7 Sept 2026", "8 Sept 2026", "9 Sept 2026", "10 Sept 2026"
  ];
  const activeObs = !!activeObsProfile;

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
        const defaultObs = obs.find(o => o.id === 'ARGO-1024');
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

  const resetView = () => {
    setActiveRegion('INDIAN_OCEAN');
    setActiveObsProfile(null);
    setComparison(null);
    setInsight(null);
    globeRef.current?.flyToRegion('INDIAN_OCEAN');
  };



  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a1322] text-slate-100 font-sans selection:bg-[#38bdf8] selection:text-white">
      
      <OceanGlobeViewer 
        ref={globeRef} 
        observations={layers.argo ? observations : []}
        onObservationSelect={handleObservationSelect}
        activeObservationId={activeObsProfile?.id || null}
        activeVar={activeVar}
        depth={depth}
        showModelLayer={layers.model}
        comparison={comparison}
      />
      
      <RegionPresetBar activeRegion={activeRegion} onSelectRegion={handleRegionSelect} />

      {/* TOP HEADER BAR */}
      <header className="absolute top-0 inset-x-0 h-14 z-20 flex items-center justify-between px-6 bg-slate-900/80 border-b border-slate-700/60 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[#38bdf8]">
            <Activity className="w-5 h-5" />
            <h1 className="text-lg font-semibold tracking-wide text-white">Ocean Insight</h1>
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <p className="text-xs text-slate-400 font-medium">Interactive Ocean Data Intelligence Platform</p>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
              Model Grid
            </span>
            <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
              DEMO DATASET
            </span>
          </div>
          <div className="text-sm font-mono text-slate-300">
            {dates[dateIndex] ? new Date(dates[dateIndex]).toLocaleDateString() : ''}, 12:00 UTC
          </div>
          <button 
            onClick={resetView}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset View
          </button>
        </div>
      </header>

      {/* LEFT CONTROL PANEL */}
      <aside className="absolute top-20 left-6 w-80 z-10 flex flex-col gap-4">
        {/* Controls Card */}
        <div className="bg-slate-900/80 border border-slate-700/60 backdrop-blur-md rounded-xl p-5 shadow-2xl flex flex-col gap-6">
          
          {/* Variable Selector */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Settings className="w-3.5 h-3.5" /> Data Variable
            </h3>
            <div className="flex bg-slate-800/80 p-1 rounded-lg border border-slate-700">
              {variables.map(v => (
                <button 
                  key={v.id}
                  onClick={() => setActiveVar(v.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all ${activeVar === v.id ? 'bg-[#0284c7] text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {v.id === 'temperature' ? <Thermometer className="w-3.5 h-3.5" /> : <Droplets className="w-3.5 h-3.5" />} 
                  {v.name} ({v.unit})
                </button>
              ))}
            </div>
          </div>

          {/* Depth Control */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" /> Depth Level
              </h3>
              <span className="text-xs font-mono bg-[#38bdf8]/10 text-[#38bdf8] px-2 py-0.5 rounded border border-[#38bdf8]/20">{depth}m</span>
            </div>
            <div className="px-1">
              <input 
                type="range" 
                min="0" max="500" step="50"
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-2 px-1">
                <span>0m</span>
                <span>50m</span>
                <span>100m</span>
                <span>200m</span>
                <span>300m</span>
                <span>500m</span>
              </div>
            </div>
          </div>

          {/* Layer Toggles */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Data Layers</h3>
            <div className="flex flex-col gap-2">
              <LayerToggle 
                label="Ocean Model Grid" 
                active={layers.model} 
                onChange={() => setLayers(l => ({ ...l, model: !l.model }))} 
              />
              <LayerToggle 
                label="Argo Observations" 
                active={layers.argo} 
                onChange={() => setLayers(l => ({ ...l, argo: !l.argo }))} 
              />
              <LayerToggle 
                label="Gliders" 
                active={layers.gliders} 
                disabled 
              />
              <LayerToggle 
                label="Surface Currents" 
                active={layers.currents} 
                disabled 
              />
            </div>
          </div>
        </div>

        {/* Colorbar Legend */}
        <div className="bg-slate-900/80 border border-slate-700/60 backdrop-blur-md rounded-xl p-4 shadow-xl">
          <div className="flex justify-between text-xs font-medium text-slate-300 mb-2">
            <span>{activeVar === 'temperature' ? '12°C' : '34 PSU'}</span>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
              MODEL {activeVar === 'temperature' ? 'TEMPERATURE (°C)' : 'SALINITY (PSU)'}
            </span>
            <span>{activeVar === 'temperature' ? '30°C' : '36 PSU'}</span>
          </div>
          <div className={`h-3 w-full rounded-full bg-gradient-to-r ${activeVar === 'temperature' ? 'from-blue-600 via-cyan-400 via-yellow-400 via-orange-400 to-red-500' : 'from-[#0a1e50] via-[#149664] to-[#96dc32]'}`}></div>
        </div>
      </aside>

      {/* RIGHT ANALYSIS PANEL */}
      <aside className="absolute top-20 right-6 w-96 z-10">
        <div className="bg-slate-900/80 border border-slate-700/60 backdrop-blur-md rounded-xl shadow-2xl overflow-hidden transition-all duration-300 min-h-[300px] flex flex-col">
          
          {!activeObs ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-70">
              <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
                <Globe2 className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-sm font-medium text-slate-200 mb-2">No Selection Active</h3>
              <p className="text-xs text-slate-400">Select an observation marker on the globe to inspect its profile and compare with model data.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b border-slate-700/60 bg-slate-800/40">
                <div className="text-[9px] uppercase tracking-widest font-bold text-slate-500 mb-2">ARGO OBSERVATION</div>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      {activeObsProfile?.id}
                    </h2>
                    <p className="text-[10px] text-[#38bdf8] font-medium uppercase tracking-wider mb-2">{activeObsProfile?.type}</p>
                    <div className="inline-flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">
                      Observation Available
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono text-slate-300">Location:<br/>{activeObsProfile?.latitude}°N, {activeObsProfile?.longitude}°E</div>
                    <div className="text-[10px] text-slate-400 mt-2">Timestamp:<br/>{new Date(activeObsProfile?.timestamp || '').toLocaleDateString()} • 14:30 UTC</div>
                    <div className="text-[10px] text-slate-400 mt-2">Selected Depth:<br/>{depth} m</div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex flex-col gap-4 overflow-y-auto">
                
                {/* Profile Chart */}
                <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 relative h-40 flex items-center justify-center group">
                  <div className="absolute left-8 top-2 bottom-6 w-px bg-slate-700"></div>
                  <div className="absolute left-8 right-2 bottom-6 h-px bg-slate-700"></div>
                  
                  <div className="absolute left-8 right-2 top-2 bottom-6 overflow-visible">
                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                      {/* Grid lines */}
                      <line x1="0" y1="20" x2="100" y2="20" stroke="#334155" strokeWidth="0.5" strokeDasharray="2" />
                      <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="0.5" strokeDasharray="2" />
                      <line x1="0" y1="100" x2="100" y2="100" stroke="#334155" strokeWidth="0.5" strokeDasharray="2" />
                      
                      {activeObsProfile?.profiles && (
                        <polyline 
                          points={activeObsProfile.profiles.map(p => {
                            const val = p[activeVar as 'temperature' | 'salinity'];
                            if (val === undefined) return '';
                            const min = activeVar === 'temperature' ? 12 : 34;
                            const max = activeVar === 'temperature' ? 30 : 36;
                            const x = ((val - min) / (max - min)) * 100;
                            const y = (p.depth / 500) * 100;
                            return `${x},${y}`;
                          }).filter(Boolean).join(' ')} 
                          fill="none" stroke="#38bdf8" strokeWidth="2" 
                        />
                      )}
                      
                      {/* Highlight current depth */}
                      <line x1="0" y1={(depth/500)*100} x2="100" y2={(depth/500)*100} stroke="#f97316" strokeWidth="1" strokeDasharray="2" />
                    </svg>
                  </div>
                  
                  <div className="text-[9px] font-mono text-slate-500 absolute left-2 top-0">0m</div>
                  <div className="text-[9px] font-mono text-slate-500 absolute left-2 top-1/2 -translate-y-1/2">250m</div>
                  <div className="text-[9px] font-mono text-slate-500 absolute left-2 bottom-4">500m</div>
                  <div className="text-[9px] text-slate-500 absolute bottom-1 right-2 uppercase tracking-widest font-bold">ARGO VERTICAL PROFILE</div>
                </div>

                {/* Comparison Card */}
                {comparison ? (
                  <div className="bg-slate-800/50 rounded-lg border border-slate-700/60 p-3">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wide">MODEL VS ARGO</h4>
                    </div>
                    
                    <div className="flex flex-col gap-3 mb-4">
                      <div className="grid grid-cols-3 gap-2 text-center divide-x divide-slate-700">
                        <div>
                          <div className="text-[10px] text-slate-400 mb-1 uppercase">Model Temp</div>
                          <div className="text-sm font-mono text-slate-200">{comparison.model_temperature}°C</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 mb-1 uppercase">ARGO Temp</div>
                          <div className="text-sm font-mono text-[#38bdf8]">{comparison.argo_temperature}°C</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 mb-1 uppercase">Difference</div>
                          <div className={`text-sm font-mono font-bold ${comparison.severity === 'significant' ? 'text-[#ef4444]' : 'text-slate-200'}`}>
                            {comparison.temperature_difference !== undefined && comparison.temperature_difference > 0 ? '+' : ''}{comparison.temperature_difference}°C
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center divide-x divide-slate-700">
                        <div>
                          <div className="text-[10px] text-slate-400 mb-1 uppercase">Model Sal</div>
                          <div className="text-sm font-mono text-slate-200">{comparison.model_salinity} PSU</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 mb-1 uppercase">ARGO Sal</div>
                          <div className="text-sm font-mono text-[#38bdf8]">{comparison.argo_salinity} PSU</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 mb-1 uppercase">Difference</div>
                          <div className={`text-sm font-mono font-bold ${comparison.severity === 'significant' ? 'text-[#ef4444]' : 'text-slate-200'}`}>
                            {comparison.salinity_difference !== undefined && comparison.salinity_difference > 0 ? '+' : ''}{comparison.salinity_difference} PSU
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 mb-1 uppercase text-center">Status</div>
                      <div className={`text-[10px] font-bold border px-2 py-1.5 rounded text-center uppercase tracking-wider ${
                          comparison.severity === 'significant' ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20' :
                          comparison.severity === 'moderate' ? 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20' :
                          'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20'
                        }`}>
                          {comparison.severity} DEVIATION
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800/50 rounded-lg border border-slate-700/60 p-3 text-center text-xs text-slate-400">
                    No comparison data available for {depth}m depth.
                  </div>
                )}

                {/* Insight Banner */}
                {insight && (
                  <div>
                    <div className="text-[9px] uppercase tracking-widest font-bold text-slate-500 mb-1">OCEAN INSIGHT</div>
                    <div className="bg-[#0f172a] border border-slate-700 rounded-lg p-3 flex flex-col gap-3">
                      <div className="flex gap-2 items-start mb-2">
                        <AlertTriangle className="w-4 h-4 text-[#38bdf8] shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-300 leading-relaxed font-medium">
                          {insight.message}
                        </p>
                      </div>
                      
                      <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">Observation Status:</div>
                          <div className={`text-xs font-semibold ${insight.severity === 'SIGNIFICANT DEVIATION' ? 'text-[#ef4444]' : 'text-slate-300'}`}>{insight.severity}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">Explanation:</div>
                          <div className="text-xs text-slate-400">{insight.explanation}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">Confidence:</div>
                          <div className="text-xs text-[#10b981] font-semibold">{insight.confidence}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action */}
                <button className="w-full flex items-center justify-center gap-2 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold uppercase tracking-wider py-3 rounded-lg transition-colors mt-2">
                  COMPARE WITH MODEL <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* BOTTOM TIMELINE & PLAYBACK */}
      <div className="absolute bottom-6 inset-x-0 flex justify-center z-20 pointer-events-none">
        <div className="w-full max-w-3xl pointer-events-auto bg-slate-900/90 border border-slate-700/60 backdrop-blur-xl rounded-2xl shadow-2xl p-4 flex items-center gap-6">
          
          {/* Playback Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-600">
              <StepBack className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-[#38bdf8] hover:bg-[#0284c7] text-[#060d17] transition-colors shadow-[0_0_15px_rgba(56,189,248,0.4)]"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-600">
              <StepForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Date Slider */}
          <div className="flex-1 flex flex-col pt-2">
            <div className="relative">
              <input 
                type="range" 
                min="0" 
                max={Math.max(0, dates.length - 1)} 
                value={dateIndex}
                onChange={(e) => setDateIndex(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#38bdf8] relative z-10"
              />
              {/* Tick marks */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between px-[7px] pointer-events-none z-0">
                {dates.map((_, i) => (
                  <div key={i} className="w-0.5 h-2.5 bg-slate-600"></div>
                ))}
              </div>
            </div>
            
            {/* Date Labels */}
            <div className="flex justify-between mt-2 px-1">
              {dates.map((date, i) => {
                const d = new Date(date);
                const str = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
                return (
                  <div 
                    key={i} 
                    className={`text-[9px] font-mono transition-colors ${i === dateIndex ? 'text-[#38bdf8] font-bold text-[10px]' : 'text-slate-500'}`}
                    style={{ transform: i === dateIndex ? 'translateY(1px)' : 'none' }}
                  >
                    {i === 0 || i === dates.length - 1 || i === dateIndex ? str : ''}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Active Date Display */}
          <div className="shrink-0 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 min-w-[120px] text-center">
            <div className="text-[10px] text-slate-400 font-medium uppercase mb-0.5">Active Date</div>
            <div className="text-sm font-mono text-[#38bdf8] font-bold">{dates[dateIndex] ? new Date(dates[dateIndex]).toLocaleDateString() : ''}</div>
          </div>
          
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
