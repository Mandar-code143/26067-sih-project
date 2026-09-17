export interface Variable {
  id: string;
  name: string;
  unit: string;
}

export interface ModelMetadata {
  geographic_bounds: {
    lat_min: number;
    lat_max: number;
    lon_min: number;
    lon_max: number;
  };
  available_depths: number[];
  available_timestamps: string[];
  variables: string[];
  dataset_info: string;
}

export interface ObservationSummary {
  id: string;
  type: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface ObservationProfile extends ObservationSummary {
  profiles: {
    depth: number;
    temperature?: number;
    salinity?: number;
  }[];
}

export interface DataComparison {
  model_value: number;
  observed_value: number;
  difference: number;
  severity: "normal" | "moderate" | "significant";
  observation_id: string;
  variable: string;
  depth: number;
  model_salinity?: number;
  argo_salinity?: number;
  salinity_difference?: number;
  model_temperature?: number;
  argo_temperature?: number;
  temperature_difference?: number;
}

export interface Insight {
  argo_id: string;
  depth: number;
  severity: string;
  confidence: string;
  message: string;
  explanation: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const fetchVariables = async (): Promise<Variable[]> => {
  const res = await fetch(`${API_BASE_URL}/api/variables`);
  const data = await res.json();
  return data.variables;
};

export const fetchMetadata = async (): Promise<ModelMetadata> => {
  const res = await fetch(`${API_BASE_URL}/api/model/metadata`);
  return res.json();
};

export const fetchObservations = async (): Promise<ObservationSummary[]> => {
  const res = await fetch(`${API_BASE_URL}/api/observations`);
  return res.json();
};

export const fetchObservationProfile = async (id: string): Promise<ObservationProfile> => {
  const res = await fetch(`${API_BASE_URL}/api/observations/${id}`);
  return res.json();
};

export const fetchComparison = async (id: string, variable: string, depth: number): Promise<DataComparison> => {
  const res = await fetch(`${API_BASE_URL}/api/comparison/${id}?variable=${variable}&depth=${depth}`);
  if (!res.ok) throw new Error("Comparison unavailable");
  return res.json();
};

export const fetchInsight = async (id: string, depth: number): Promise<Insight> => {
  const res = await fetch(`${API_BASE_URL}/api/insights/${id}?depth=${depth}`);
  if (!res.ok) throw new Error("Insight unavailable");
  return res.json();
};
