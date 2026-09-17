import { useEffect, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { type ObservationSummary, type DataComparison } from './services/api';

export type RegionKey = 'INDIAN_OCEAN' | 'ARABIAN_SEA' | 'BAY_OF_BENGAL';

export interface OceanGlobeRef {
  flyToRegion: (regionKey: RegionKey) => void;
  focusObservation: (lat: number, lon: number) => void;
}

const REGIONS: Record<RegionKey, Cesium.Rectangle> = {
  INDIAN_OCEAN: Cesium.Rectangle.fromDegrees(30.0, -40.0, 120.0, 30.0),
  ARABIAN_SEA: Cesium.Rectangle.fromDegrees(55.0, 5.0, 77.5, 26.0),
  BAY_OF_BENGAL: Cesium.Rectangle.fromDegrees(78.0, 4.0, 98.0, 23.0)
};

interface OceanGlobeProps {
  observations: ObservationSummary[];
  onObservationSelect: (obs: ObservationSummary) => void;
  activeObservationId: string | null;
  activeVar: string;
  depth: number;
  showModelLayer: boolean;
  comparison: DataComparison | null;
}

// Generates a mock heatmap texture for the ocean model
function generateHeatmapCanvas(variable: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Draw some procedural looking gradients
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  if (variable === 'temperature') {
    gradient.addColorStop(0, 'rgba(0, 50, 150, 0.6)'); // Blue
    gradient.addColorStop(0.3, 'rgba(0, 200, 255, 0.6)'); // Cyan
    gradient.addColorStop(0.6, 'rgba(255, 220, 0, 0.6)'); // Yellow
    gradient.addColorStop(0.8, 'rgba(255, 120, 0, 0.6)'); // Orange
    gradient.addColorStop(1, 'rgba(200, 0, 0, 0.6)'); // Red
  } else {
    gradient.addColorStop(0, 'rgba(10, 30, 80, 0.6)');
    gradient.addColorStop(0.5, 'rgba(20, 150, 100, 0.6)');
    gradient.addColorStop(1, 'rgba(150, 220, 50, 0.6)');
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  // Add some "blobs" to make it look like data
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 50 + Math.random() * 150;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    if (variable === 'temperature') {
      g.addColorStop(0, `rgba(${150 + Math.random()*100}, ${Math.random()*100}, 0, 0.4)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      g.addColorStop(0, `rgba(0, ${150 + Math.random()*100}, ${100 + Math.random()*150}, 0.4)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

const OceanGlobeViewer = forwardRef<OceanGlobeRef, OceanGlobeProps>(({ 
  observations, 
  onObservationSelect,
  activeObservationId,
  activeVar,
  depth,
  showModelLayer,
  comparison
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const obsRef = useRef(observations);
  const onSelectRef = useRef(onObservationSelect);

  // Keep refs for event handler closure
  useEffect(() => {
    obsRef.current = observations;
    onSelectRef.current = onObservationSelect;
  }, [observations, onObservationSelect]);

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

    Cesium.ArcGisMapServerImageryProvider.fromUrl(
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer', {
        enablePickFeatures: false
      }
    ).then((provider) => {
      if (viewerRef.current) {
        const layer = viewerRef.current.imageryLayers.addImageryProvider(provider);
        // Slightly subdue to not overpower model, but keep it realistic
        layer.brightness = 0.8;
        layer.contrast = 1.2;
        layer.saturation = 0.8;
      }
    });

    // Add labels and boundaries
    Cesium.ArcGisMapServerImageryProvider.fromUrl(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer', {
        enablePickFeatures: false
      }
    ).then((provider) => {
      if (viewerRef.current) {
        viewerRef.current.imageryLayers.addImageryProvider(provider);
      }
    });
    
    // Hide default Cesium logo
    const creditContainer = viewer.bottomContainer;
if (creditContainer instanceof HTMLElement) {
  creditContainer.style.display = 'none';
}

    viewer.scene.globe.enableLighting = true;
    // Darken globe base color
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#020813');
    
    // Enable translucency so layers beneath the surface are visible
    viewer.scene.globe.translucency.enabled = true;
    viewer.scene.globe.translucency.frontFaceAlphaByDistance = new Cesium.NearFarScalar(400.0, 0.9, 8000.0, 0.9);
    
    viewerRef.current = viewer;

    // Default overview
    viewer.camera.setView({
      destination: REGIONS.INDIAN_OCEAN
    });

    // Handle clicks
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const pickedObject = viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id && typeof pickedObject.id.id === 'string' && pickedObject.id.id.startsWith('obs_')) {
        const obsId = pickedObject.id.id.replace('obs_', '');
        const obs = obsRef.current.find(o => o.id === obsId);
        if (obs) {
          onSelectRef.current(obs);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  // Update Model Layer
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const layerId = 'model_data_layer';
    let entity = viewer.entities.getById(layerId);

    if (showModelLayer) {
      const canvas = generateHeatmapCanvas(activeVar);
      
      if (!entity) {
        viewer.entities.add({
          id: layerId,
          rectangle: {
            coordinates: REGIONS.INDIAN_OCEAN,
            material: new Cesium.ImageMaterialProperty({
              image: canvas,
              transparent: true,
              color: Cesium.Color.WHITE.withAlpha(0.75)
            }),
            height: -depth // Render at depth below surface
          }
        });
      } else {
        if (entity.rectangle) {
          entity.rectangle.material = new Cesium.ImageMaterialProperty({
            image: canvas,
            transparent: true,
            color: Cesium.Color.WHITE.withAlpha(0.75)
          });
          entity.rectangle.height = new Cesium.ConstantProperty(-depth);
        }
      }
    } else {
      if (entity) {
        viewer.entities.remove(entity);
      }
    }
  }, [showModelLayer, activeVar, depth]);

  // Update observations when they change
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Remove existing observation entities
    const entitiesToRemove = viewer.entities.values.filter(e => e.id.startsWith('obs_'));
    entitiesToRemove.forEach(e => viewer.entities.remove(e));

    // Add new observations
    observations.forEach(obs => {
      const isSelected = obs.id === activeObservationId;
      const hasDeviation = isSelected && comparison?.severity === 'significant';
      
      let color = Cesium.Color.fromCssColorString('#0ea5e9'); // Cyan/Blue
      let outlineColor = Cesium.Color.fromCssColorString('#0284c7');
      let size = 8;

      if (isSelected) {
        color = Cesium.Color.fromCssColorString('#38bdf8'); // Bright cyan
        outlineColor = Cesium.Color.WHITE;
        size = 12;
      }
      
      if (hasDeviation) {
        outlineColor = Cesium.Color.fromCssColorString('#ef4444'); // Red warning ring
      }

      viewer.entities.add({
        id: `obs_${obs.id}`,
        position: Cesium.Cartesian3.fromDegrees(obs.longitude, obs.latitude, 0),
        point: {
          pixelSize: size,
          color: color,
          outlineColor: outlineColor,
          outlineWidth: isSelected ? 3 : 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY // Always visible
        },
        label: {
          text: isSelected ? obs.id : '',
          font: 'bold 12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          style: Cesium.LabelStyle.FILL,
          showBackground: true,
          backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
    });
  }, [observations, activeObservationId, comparison]);

  useImperativeHandle(ref, () => ({
    flyToRegion(regionKey: RegionKey) {
      const viewer = viewerRef.current;
      if (!viewer) return;
      
      const destination = REGIONS[regionKey];
      if (!destination) return;

      viewer.camera.flyTo({
        destination,
        duration: 2.0,
        easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-60), // More angled for 3D effect
          roll: 0.0
        }
      });
    },
    focusObservation(lat: number, lon: number) {
      const viewer = viewerRef.current;
      if (!viewer) return;

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, 450000), // Zoom in
        duration: 2.0,
        easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-60),
          roll: 0.0
        }
      });
    }
  }));

  const activeObsDetails = useMemo(() => {
    return observations.find(o => o.id === activeObservationId);
  }, [observations, activeObservationId]);

  return (
    <div className="absolute inset-0 z-0 w-full h-full bg-[#020813]">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Absolute Overlays on top of the map */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none z-10 text-center drop-shadow-md">
        <h2 className="text-xl font-black tracking-widest text-white/90 uppercase">
          MODEL {activeVar === 'temperature' ? 'TEMPERATURE' : 'SALINITY'}
        </h2>
        <p className="text-[#38bdf8] font-mono font-bold">{depth} m DEPTH</p>
      </div>

      {/* Floating Tooltip connected to the active marker */}
      {/* Since tracking HTML element to Cesium point is complex for MVP, we position it fixed but style it like a floating tooltip */}
      {activeObsDetails && comparison && (
        <div className="absolute top-1/2 left-1/2 ml-16 -mt-16 pointer-events-none z-10 bg-slate-900/90 border border-slate-700/80 p-3 rounded-lg shadow-xl backdrop-blur-sm">
          <div className="text-xs font-bold text-white mb-1">{activeObservationId}</div>
          <div className="text-[10px] text-slate-400 font-mono mb-2">{depth} m</div>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="text-slate-400">Model:</div>
            <div className="font-mono text-slate-200 text-right">{comparison.model_value}{activeVar === 'temperature' ? '°C' : ''}</div>
            
            <div className="text-slate-400">Observed:</div>
            <div className="font-mono text-[#38bdf8] text-right">{comparison.observed_value}{activeVar === 'temperature' ? '°C' : ''}</div>
            
            <div className="col-span-2 h-px bg-slate-700 my-0.5"></div>
            
            <div className="text-slate-400 font-bold">Δ</div>
            <div className={`font-mono text-right font-bold ${comparison.severity === 'significant' ? 'text-[#ef4444]' : 'text-slate-200'}`}>
              {comparison.difference > 0 ? '+' : ''}{comparison.difference}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default OceanGlobeViewer;
