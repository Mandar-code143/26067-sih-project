export interface Variable {
  id: string;
  name: string;
  unit: string;
  palette?: string;
  default_range?: [number, number];
}

export interface ModelMetadata {
  title: string;
  institution: string;
  geographic_bounds: {
    lat_min: number;
    lat_max: number;
    lon_min: number;
    lon_max: number;
  };
  grid_shape: {
    lat_count: number;
    lon_count: number;
    depth_count: number;
    time_count: number;
  };
  available_depths: number[];
  available_timestamps: string[];
  variables: Variable[];
}

export interface GridBinaryData {
  buffer: Float32Array;
  rows: number;
  cols: number;
  lat_min: number;
  lat_max: number;
  lon_min: number;
  lon_max: number;
  min_value: number;
  max_value: number;
  depth: number;
  variable: string;
}

export interface VolumeBinaryData {
  buffer: Float32Array;
  shape: [number, number, number]; // [depths, rows, cols]
  depths: number[];
  min_value: number;
  max_value: number;
  variable: string;
}

export interface ObservationSummary {
  id: string;
  wmo?: string;
  type: string;
  sensor?: string;
  region?: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  max_depth?: number;
  profile_levels?: number;
}

export interface ObservationProfile extends ObservationSummary {
  profiles: {
    depth: number;
    temperature?: number;
    salinity?: number;
    chlorophyll?: number;
    dissolved_oxygen?: number;
    qc_flag?: number;
  }[];
  trajectory?: {
    latitude: number;
    longitude: number;
    cycle_number: number;
    timestamp: string;
  }[];
}

export interface GliderSummary {
  id: string;
  mission_name: string;
  platform_type: string;
  region: string;
  status: string;
  total_waypoints: number;
  max_depth: number;
  current_position: {
    latitude: number;
    longitude: number;
  };
}

export interface GliderMission extends GliderSummary {
  start_point: { latitude: number; longitude: number };
  end_point: { latitude: number; longitude: number };
  waypoints: {
    seq: number;
    latitude: number;
    longitude: number;
    depth: number;
    temperature: number;
    salinity: number;
    chlorophyll: number;
    timestamp: string;
  }[];
}

export interface DataComparison {
  observation_id: string;
  platform_type: string;
  region: string;
  depth: number;
  variable: string;
  unit: string;
  model_value: number;
  observed_value: number;
  difference: number;
  abs_difference: number;
  column_rmse: number;
  severity: "normal" | "moderate" | "significant";
  status: string;
  confidence_score: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  // Legacy / convenience fields
  model_temperature?: number;
  argo_temperature?: number;
  temperature_difference?: number;
  model_salinity?: number;
  argo_salinity?: number;
  salinity_difference?: number;
}

export interface Insight {
  argo_id: string;
  depth: number;
  severity: string;
  severity_level: "normal" | "moderate" | "significant";
  confidence: string;
  message: string;
  explanation: string;
  column_rmse?: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const fetchVariables = async (): Promise<Variable[]> => {
  const res = await fetch(`${API_BASE_URL}/api/variables`);
  if (!res.ok) throw new Error("Failed to fetch variables");
  const data = await res.json();
  return data.variables;
};

export const fetchMetadata = async (): Promise<ModelMetadata> => {
  const res = await fetch(`${API_BASE_URL}/api/model/metadata`);
  if (!res.ok) throw new Error("Failed to fetch metadata");
  return res.json();
};

export const fetchGridBinary = async (
  variable: string, 
  depth: number, 
  timestamp: string
): Promise<GridBinaryData> => {
  const res = await fetch(
    `${API_BASE_URL}/api/model/grid/binary?variable=${encodeURIComponent(variable)}&depth=${depth}&time=${encodeURIComponent(timestamp)}`
  );
  if (!res.ok) throw new Error("Failed to fetch binary grid");

  const arrayBuffer = await res.arrayBuffer();
  const float32Array = new Float32Array(arrayBuffer);

  return {
    buffer: float32Array,
    rows: parseInt(res.headers.get("X-Grid-Rows") || "0", 10),
    cols: parseInt(res.headers.get("X-Grid-Cols") || "0", 10),
    lat_min: parseFloat(res.headers.get("X-Lat-Min") || "0"),
    lat_max: parseFloat(res.headers.get("X-Lat-Max") || "0"),
    lon_min: parseFloat(res.headers.get("X-Lon-Min") || "0"),
    lon_max: parseFloat(res.headers.get("X-Lon-Max") || "0"),
    min_value: parseFloat(res.headers.get("X-Data-Min") || "0"),
    max_value: parseFloat(res.headers.get("X-Data-Max") || "0"),
    depth: parseFloat(res.headers.get("X-Depth") || `${depth}`),
    variable: res.headers.get("X-Variable") || variable
  };
};

export const fetchVolumeBinary = async (
  variable: string,
  timestamp: string
): Promise<VolumeBinaryData> => {
  const res = await fetch(
    `${API_BASE_URL}/api/model/volume/binary?variable=${encodeURIComponent(variable)}&time=${encodeURIComponent(timestamp)}`
  );
  if (!res.ok) throw new Error("Failed to fetch binary volume cube");

  const arrayBuffer = await res.arrayBuffer();
  const float32Array = new Float32Array(arrayBuffer);
  const shapeHeader = res.headers.get("X-Volume-Shape");
  const depthsHeader = res.headers.get("X-Depths");

  return {
    buffer: float32Array,
    shape: shapeHeader ? JSON.parse(shapeHeader) : [1, 1, 1],
    depths: depthsHeader ? JSON.parse(depthsHeader) : [0],
    min_value: parseFloat(res.headers.get("X-Data-Min") || "0"),
    max_value: parseFloat(res.headers.get("X-Data-Max") || "0"),
    variable: res.headers.get("X-Variable") || variable
  };
};

export const fetchObservations = async (): Promise<ObservationSummary[]> => {
  const res = await fetch(`${API_BASE_URL}/api/observations`);
  if (!res.ok) throw new Error("Failed to fetch observations");
  return res.json();
};

export const fetchObservationProfile = async (id: string): Promise<ObservationProfile> => {
  const res = await fetch(`${API_BASE_URL}/api/observations/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch observation profile for ${id}`);
  return res.json();
};

export const fetchGliders = async (): Promise<GliderSummary[]> => {
  const res = await fetch(`${API_BASE_URL}/api/observations/gliders`);
  if (!res.ok) throw new Error("Failed to fetch gliders");
  return res.json();
};

export const fetchGliderMission = async (id: string): Promise<GliderMission> => {
  const res = await fetch(`${API_BASE_URL}/api/observations/gliders/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch glider mission for ${id}`);
  return res.json();
};

export const fetchComparison = async (
  id: string, 
  variable: string = "temperature", 
  depth: number = 100
): Promise<DataComparison> => {
  const res = await fetch(
    `${API_BASE_URL}/api/comparison/${encodeURIComponent(id)}?variable=${encodeURIComponent(variable)}&depth=${depth}`
  );
  if (!res.ok) throw new Error("Comparison unavailable");
  return res.json();
};

export const fetchInsight = async (id: string, depth: number = 100): Promise<Insight> => {
  const res = await fetch(`${API_BASE_URL}/api/insights/${encodeURIComponent(id)}?depth=${depth}`);
  if (!res.ok) throw new Error("Insight unavailable");
  return res.json();
};
