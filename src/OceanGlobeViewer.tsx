import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { 
  type ObservationSummary, 
  type GliderMission,
  type DataComparison,
  fetchGridBinary,
  fetchGliders,
  fetchGliderMission
} from './services/api';
import { createColormapTexture, type ColormapName } from './utils/colormaps';

export type RegionKey = 'INDIAN_OCEAN' | 'ARABIAN_SEA' | 'BAY_OF_BENGAL' | 'EQUATORIAL_IO';

export interface OceanGlobeRef {
  flyToRegion: (regionKey: RegionKey) => void;
  focusObservation: (lat: number, lon: number, depth?: number) => void;
  focusGlider: (lat: number, lon: number) => void;
}

const REGIONS: Record<RegionKey, { rect: Cesium.Rectangle; heading: number; pitch: number; range: number }> = {
  INDIAN_OCEAN: {
    rect: Cesium.Rectangle.fromDegrees(45.0, -15.0, 100.0, 28.0),
    heading: 0,
    pitch: -55,
    range: 6500000
  },
  ARABIAN_SEA: {
    rect: Cesium.Rectangle.fromDegrees(52.0, 4.0, 78.0, 26.0),
    heading: 10,
    pitch: -45,
    range: 3200000
  },
  BAY_OF_BENGAL: {
    rect: Cesium.Rectangle.fromDegrees(78.0, 4.0, 98.0, 24.0),
    heading: -10,
    pitch: -45,
    range: 3000000
  },
  EQUATORIAL_IO: {
    rect: Cesium.Rectangle.fromDegrees(60.0, -12.0, 95.0, 8.0),
    heading: 0,
    pitch: -40,
    range: 3800000
  }
};

interface OceanGlobeProps {
  observations: ObservationSummary[];
  onObservationSelect: (obs: ObservationSummary) => void;
  onGliderSelect?: (glider: GliderMission) => void;
  activeObservationId: string | null;
  activeVar: string;
  depth: number;
  timestamp?: string;
  showModelLayer: boolean;
  showArgoLayer: boolean;
  showGlidersLayer: boolean;
  showCurrentsLayer: boolean;
  verticalExaggeration?: number; // Scaling factor for depth (e.g., 200x)
  comparison: DataComparison | null;
}

const OceanGlobeViewer = forwardRef<OceanGlobeRef, OceanGlobeProps>(({ 
  observations, 
  onObservationSelect,
  onGliderSelect,
  activeObservationId,
  activeVar,
  depth,
  timestamp = "2026-09-08T12:00:00",
  showModelLayer,
  showArgoLayer,
  showGlidersLayer,
  showCurrentsLayer,
  verticalExaggeration = 250,
  comparison
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [gliders, setGliders] = useState<GliderMission[]>([]);
  const [activeGliderId, setActiveGliderId] = useState<string | null>(null);
  const [isLoadingGrid, setIsLoadingGrid] = useState<boolean>(false);
  const [dataStats, setDataStats] = useState<{ min: number; max: number; unit: string } | null>(null);

  // Dynamic Refs for event closures
  const obsRef = useRef(observations);
  const glidersRef = useRef(gliders);
  const onObsSelectRef = useRef(onObservationSelect);
  const onGliderSelectRef = useRef(onGliderSelect);

  useEffect(() => {
    obsRef.current = observations;
    glidersRef.current = gliders;
    onObsSelectRef.current = onObservationSelect;
    onGliderSelectRef.current = onGliderSelect;
  }, [observations, gliders, onObservationSelect, onGliderSelect]);

  // Load Glider Missions from API
  useEffect(() => {
    async function loadGliders() {
      try {
        const summaries = await fetchGliders();
        const fullMissions = await Promise.all(
          summaries.map(s => fetchGliderMission(s.id).catch(() => null))
        );
        const valid = fullMissions.filter(Boolean) as GliderMission[];
        setGliders(valid);
      } catch (err) {
        console.warn("Could not load gliders:", err);
      }
    }
    loadGliders();
  }, []);

  // Initialize Cesium 3D Globe with Subsurface Translucency
  useEffect(() => {
    if (!containerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      timeline: false,
      animation: false,
      fullscreenButton: false,
      selectionIndicator: false,
      baseLayer: false
    });

    // Dark Bathymetry & Satellite Basemap
    Cesium.ArcGisMapServerImageryProvider.fromUrl(
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer', {
        enablePickFeatures: false
      }
    ).then((provider) => {
      if (viewerRef.current) {
        const layer = viewerRef.current.imageryLayers.addImageryProvider(provider);
        layer.brightness = 0.75;
        layer.contrast = 1.3;
        layer.saturation = 0.7;
      }
    }).catch(console.error);

    // Geographic Coastlines & Boundary Reference Layer
    Cesium.ArcGisMapServerImageryProvider.fromUrl(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer', {
        enablePickFeatures: false
      }
    ).then((provider) => {
      if (viewerRef.current) {
        const layer = viewerRef.current.imageryLayers.addImageryProvider(provider);
        layer.alpha = 0.65;
      }
    }).catch(console.error);
    
    // UI Cleanup
    const creditContainer = viewer.bottomContainer;
    if (creditContainer instanceof HTMLElement) {
      creditContainer.style.display = 'none';
    }

    // Atmosphere & Sub-Surface Ocean Rendering
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#030b18');
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#020610');
    
    // Enable underground translucency for 3D sub-surface water column inspection
    viewer.scene.globe.translucency.enabled = true;
    viewer.scene.globe.translucency.frontFaceAlphaByDistance = new Cesium.NearFarScalar(1000.0, 0.85, 10000000.0, 0.95);
    viewer.scene.globe.depthTestAgainstTerrain = false;

    viewerRef.current = viewer;

    // Default Overview Camera
    viewer.camera.setView({
      destination: REGIONS.INDIAN_OCEAN.rect
    });

    // Handle 3D Raycast Object Picking
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const pickedObject = viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id && typeof pickedObject.id.id === 'string') {
        const idStr = pickedObject.id.id;
        if (idStr.startsWith('obs_')) {
          const obsId = idStr.replace('obs_', '').split('_')[0];
          const obs = obsRef.current.find(o => o.id === obsId);
          if (obs) {
            onObsSelectRef.current(obs);
          }
        } else if (idStr.startsWith('glider_')) {
          const gId = idStr.replace('glider_', '').split('_')[0];
          const glider = glidersRef.current.find(g => g.id === gId);
          if (glider) {
            setActiveGliderId(glider.id);
            if (onGliderSelectRef.current) {
              onGliderSelectRef.current(glider);
            }
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  // Update Volumetric / Depth-Resolved Binary Model Layer
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const layerId = 'ocean_model_depth_slice';
    let entity = viewer.entities.getById(layerId);

    if (!showModelLayer) {
      if (entity) viewer.entities.remove(entity);
      return;
    }

    let isMounted = true;
    setIsLoadingGrid(true);

    // Fetch binary Float32Array slice from backend
    fetchGridBinary(activeVar, depth, timestamp)
      .then((gridData) => {
        if (!isMounted || !viewerRef.current) return;
        setIsLoadingGrid(false);
        setDataStats({
          min: gridData.min_value,
          max: gridData.max_value,
          unit: activeVar === 'temperature' ? '°C' : activeVar === 'salinity' ? 'PSU' : activeVar.includes('current') ? 'm/s' : ''
        });

        // Determine Colormap
        let cmap: ColormapName = 'thermal';
        if (activeVar === 'salinity') cmap = 'haline';
        else if (activeVar.includes('current')) cmap = 'balance';
        else if (activeVar === 'chlorophyll') cmap = 'algae';
        else if (activeVar === 'dissolved_oxygen') cmap = 'dense';

        const canvas = createColormapTexture(
          gridData.buffer,
          gridData.rows,
          gridData.cols,
          gridData.min_value,
          gridData.max_value,
          cmap,
          210 // semi-transparent
        );

        const bounds = Cesium.Rectangle.fromDegrees(
          gridData.lon_min,
          gridData.lat_min,
          gridData.lon_max,
          gridData.lat_max
        );

        // Exaggerated negative depth
        const renderedAltitude = -depth * verticalExaggeration;

        if (!entity) {
          viewer.entities.add({
            id: layerId,
            rectangle: {
              coordinates: bounds,
              material: new Cesium.ImageMaterialProperty({
                image: canvas,
                transparent: true
              }),
              height: renderedAltitude
            }
          });
        } else {
          if (entity.rectangle) {
            entity.rectangle.coordinates = new Cesium.ConstantProperty(bounds);
            entity.rectangle.material = new Cesium.ImageMaterialProperty({
              image: canvas,
              transparent: true
            });
            entity.rectangle.height = new Cesium.ConstantProperty(renderedAltitude);
          }
        }
      })
      .catch((err) => {
        if (isMounted) setIsLoadingGrid(false);
        console.warn("Failed to fetch binary grid layer:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [showModelLayer, activeVar, depth, timestamp, verticalExaggeration]);

  // Render 3D Water-Column Argo Profiling Floats
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Clear old observation entities
    const oldObs = viewer.entities.values.filter(e => e.id.startsWith('obs_'));
    oldObs.forEach(e => viewer.entities.remove(e));

    if (!showArgoLayer) return;

    observations.forEach((obs) => {
      const isSelected = obs.id === activeObservationId;
      const surfacePos = Cesium.Cartesian3.fromDegrees(obs.longitude, obs.latitude, 0);
      const maxD = (obs.max_depth || 2000) * verticalExaggeration;
      const bottomPos = Cesium.Cartesian3.fromDegrees(obs.longitude, obs.latitude, -maxD);

      const floatColor = isSelected ? Cesium.Color.fromCssColorString('#38bdf8') : Cesium.Color.fromCssColorString('#0ea5e9');
      const deviationAlert = isSelected && comparison?.severity === 'significant';

      // 1. Surface Beacon Point
      viewer.entities.add({
        id: `obs_${obs.id}_surface`,
        position: surfacePos,
        point: {
          pixelSize: isSelected ? 14 : 9,
          color: floatColor,
          outlineColor: deviationAlert ? Cesium.Color.fromCssColorString('#ef4444') : Cesium.Color.WHITE,
          outlineWidth: isSelected ? 3 : 1.5,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          text: isSelected ? `ARGO ${obs.wmo || obs.id}` : '',
          font: 'bold 11px sans-serif',
          fillColor: Cesium.Color.WHITE,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -18),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });

      // 2. 3D Vertical Water-Column Trajectory (from 0m down to depth)
      viewer.entities.add({
        id: `obs_${obs.id}_column`,
        polyline: {
          positions: [surfacePos, bottomPos],
          width: isSelected ? 3 : 1.5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: isSelected ? Cesium.Color.fromCssColorString('#38bdf8').withAlpha(0.9) : Cesium.Color.fromCssColorString('#0284c7').withAlpha(0.5),
            dashLength: 12.0
          })
        }
      });

      // 3. Multi-depth sensor beads along the column
      const sampleDepths = [100, 300, 500, 1000, 2000];
      sampleDepths.forEach((d) => {
        if (d <= (obs.max_depth || 2000)) {
          const beadAlt = -d * verticalExaggeration;
          viewer.entities.add({
            id: `obs_${obs.id}_bead_${d}`,
            position: Cesium.Cartesian3.fromDegrees(obs.longitude, obs.latitude, beadAlt),
            point: {
              pixelSize: isSelected && Math.abs(depth - d) < 50 ? 8 : 4,
              color: isSelected && Math.abs(depth - d) < 50 ? Cesium.Color.fromCssColorString('#f97316') : Cesium.Color.fromCssColorString('#38bdf8').withAlpha(0.7),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 1
            }
          });
        }
      });
    });
  }, [observations, activeObservationId, depth, verticalExaggeration, showArgoLayer, comparison]);

  // Render 3D Autonomous Glider Sawtooth Trajectories
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Clear old glider entities
    const oldGliders = viewer.entities.values.filter(e => e.id.startsWith('glider_'));
    oldGliders.forEach(e => viewer.entities.remove(e));

    if (!showGlidersLayer) return;

    gliders.forEach((glider) => {
      const isSelected = glider.id === activeGliderId;
      const waypoints = glider.waypoints || [];
      if (waypoints.length === 0) return;

      // Build 3D Sawtooth Polyline Coordinates
      const positions = waypoints.map(w => 
        Cesium.Cartesian3.fromDegrees(w.longitude, w.latitude, -w.depth * verticalExaggeration)
      );

      // 1. 3D Sawtooth Diving Track
      viewer.entities.add({
        id: `glider_${glider.id}_track`,
        polyline: {
          positions: positions,
          width: isSelected ? 3.5 : 2.0,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.25,
            taperPower: 0.5,
            color: isSelected ? Cesium.Color.fromCssColorString('#10b981') : Cesium.Color.fromCssColorString('#059669')
          })
        }
      });

      // 2. Current Glider Vehicle Marker
      const latestWp = waypoints[waypoints.length - 1];
      const gliderPos = Cesium.Cartesian3.fromDegrees(
        latestWp.longitude, 
        latestWp.latitude, 
        -latestWp.depth * verticalExaggeration
      );

      viewer.entities.add({
        id: `glider_${glider.id}_vehicle`,
        position: gliderPos,
        point: {
          pixelSize: isSelected ? 12 : 9,
          color: Cesium.Color.fromCssColorString('#34d399'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          text: `GLIDER: ${glider.mission_name.split(' ')[0]}`,
          font: 'bold 10px monospace',
          fillColor: Cesium.Color.fromCssColorString('#34d399'),
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
    });
  }, [gliders, activeGliderId, verticalExaggeration, showGlidersLayer]);

  // Render 3D Current Velocity Vectors / Streamlines
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const oldCurrents = viewer.entities.values.filter(e => e.id.startsWith('current_vector_'));
    oldCurrents.forEach(e => viewer.entities.remove(e));

    if (!showCurrentsLayer) return;

    // Sample vector arrows across key hydrodynamic currents
    const currentNodes = [
      { lat: 10.0, lon: 74.0, u: -0.6, v: -0.8, name: "West India Coastal Current" },
      { lat: 14.0, lon: 84.0, u: 0.5, v: 0.9, name: "East India Coastal Current" },
      { lat: 6.0, lon: 60.0, u: 1.1, v: 0.2, name: "Southwest Monsoon Current" },
      { lat: 8.0, lon: 52.0, u: 0.9, v: 1.2, name: "Somali Jet Current" },
      { lat: 15.0, lon: 88.0, u: -0.4, v: 0.6, name: "Bay of Bengal Eddy" },
      { lat: 17.0, lon: 65.0, u: 0.6, v: -0.5, name: "Arabian Sea Gyre" }
    ];

    currentNodes.forEach((node, idx) => {
      const startPos = Cesium.Cartesian3.fromDegrees(node.lon, node.lat, -depth * verticalExaggeration);
      const endPos = Cesium.Cartesian3.fromDegrees(
        node.lon + node.u * 1.5,
        node.lat + node.v * 1.5,
        -depth * verticalExaggeration
      );

      viewer.entities.add({
        id: `current_vector_${idx}`,
        polyline: {
          positions: [startPos, endPos],
          width: 2.5,
          material: new Cesium.PolylineArrowMaterialProperty(
            Cesium.Color.fromCssColorString('#facc15').withAlpha(0.85)
          )
        }
      });
    });
  }, [showCurrentsLayer, depth, verticalExaggeration]);

  // Imperative Camera Controls
  useImperativeHandle(ref, () => ({
    flyToRegion(regionKey: RegionKey) {
      const viewer = viewerRef.current;
      if (!viewer) return;
      const target = REGIONS[regionKey] || REGIONS.INDIAN_OCEAN;

      viewer.camera.flyTo({
        destination: target.rect,
        duration: 1.8,
        easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        orientation: {
          heading: Cesium.Math.toRadians(target.heading),
          pitch: Cesium.Math.toRadians(target.pitch),
          roll: 0.0
        }
      });
    },
    focusObservation(lat: number, lon: number) {
      const viewer = viewerRef.current;
      if (!viewer) return;

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, 450000),
        duration: 1.8,
        easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-50),
          roll: 0.0
        }
      });
    },
    focusGlider(lat: number, lon: number) {
      const viewer = viewerRef.current;
      if (!viewer) return;

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, 380000),
        duration: 1.8,
        easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        orientation: {
          heading: Cesium.Math.toRadians(15),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0.0
        }
      });
    }
  }));

  const activeObsDetails = observations.find(o => o.id === activeObservationId);

  return (
    <div className="absolute inset-0 z-0 w-full h-full bg-[#020610]">
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading Spinner for Binary Slices */}
      {isLoadingGrid && (
        <div className="absolute top-20 right-1/2 translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/90 border border-[#38bdf8]/40 px-4 py-2 rounded-full backdrop-blur-md shadow-2xl">
          <div className="w-3.5 h-3.5 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-mono text-[#38bdf8] font-semibold tracking-wider uppercase">Streaming Float32 Grid Slice...</span>
        </div>
      )}

      {/* Floating HUD: Depth & Variable Indicator */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none z-10 text-center drop-shadow-lg">
        <div className="bg-slate-950/80 border border-slate-700/60 px-5 py-2 rounded-xl backdrop-blur-md inline-block">
          <div className="flex items-center gap-2 justify-center">
            <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-pulse"></span>
            <h2 className="text-xs font-black tracking-widest text-white/90 uppercase">
              {activeVar.replace('_', ' ')} • {depth}m DEPTH LEVEL
            </h2>
          </div>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            Vertical Exaggeration: <span className="text-[#38bdf8] font-bold">{verticalExaggeration}×</span>
            {dataStats && ` | Range: ${dataStats.min.toFixed(1)} to ${dataStats.max.toFixed(1)} ${dataStats.unit}`}
          </p>
        </div>
      </div>

      {/* Active Observation Quick Inspection Overlay */}
      {activeObsDetails && comparison && (
        <div className="absolute bottom-24 right-6 pointer-events-none z-10 bg-slate-950/90 border border-cyan-500/40 p-4 rounded-xl shadow-2xl backdrop-blur-md w-72">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white font-mono">{activeObservationId}</span>
            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
              comparison.severity === 'significant' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
              comparison.severity === 'moderate' ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' :
              'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            }`}>
              {comparison.status}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase">Model ({depth}m)</span>
              <span className="text-slate-100 font-bold">{comparison.model_value} {comparison.unit}</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase">Argo Observed</span>
              <span className="text-[#38bdf8] font-bold">{comparison.observed_value} {comparison.unit}</span>
            </div>
          </div>

          <div className="mt-2 text-[10px] text-slate-400 flex justify-between border-t border-slate-800 pt-2 font-mono">
            <span>Column RMSE: <strong className="text-white">{comparison.column_rmse}</strong></span>
            <span>Δ: <strong className={comparison.severity === 'significant' ? 'text-red-400' : 'text-slate-200'}>
              {comparison.difference > 0 ? '+' : ''}{comparison.difference} {comparison.unit}
            </strong></span>
          </div>
        </div>
      )}
    </div>
  );
});

export default OceanGlobeViewer;
