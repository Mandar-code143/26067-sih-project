import xarray as xr
import json
import os
import pandas as pd
from typing import List, Dict, Any

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
NC_FILE = os.path.join(DATA_DIR, "ocean_data.nc")
OBS_FILE = os.path.join(DATA_DIR, "mock_observations.json")

class DataService:
    def __init__(self):
        self.ds = None
        self.observations = []
        self.load_data()

    def load_data(self):
        if os.path.exists(NC_FILE):
            self.ds = xr.open_dataset(NC_FILE)
        if os.path.exists(OBS_FILE):
            with open(OBS_FILE, "r") as f:
                self.observations = json.load(f)

    def get_metadata(self) -> Dict[str, Any]:
        if self.ds is None:
            return {}
        
        return {
            "geographic_bounds": {
                "lat_min": float(self.ds.latitude.min()),
                "lat_max": float(self.ds.latitude.max()),
                "lon_min": float(self.ds.longitude.min()),
                "lon_max": float(self.ds.longitude.max()),
            },
            "available_depths": [float(d) for d in self.ds.depth.values],
            "available_timestamps": [str(t) for t in self.ds.time.values],
            "variables": ["temperature", "salinity"],
            "dataset_info": "Ocean Insight Mock Data (MVP)"
        }

    def get_grid_data(self, variable: str, depth: float, time_str: str) -> Dict[str, Any]:
        if self.ds is None:
            return {}
        
        # Select nearest depth and time
        time_val = pd.to_datetime(time_str).tz_localize(None)
        subset = self.ds.sel(depth=depth, time=time_val, method="nearest")
        
        if variable not in subset.data_vars:
            return {}
            
        data = subset[variable].values
        
        return {
            "variable": variable,
            "depth": float(subset.depth.values),
            "timestamp": str(subset.time.values),
            "lats": [float(lat) for lat in subset.latitude.values],
            "lons": [float(lon) for lon in subset.longitude.values],
            "data": data.tolist() # 2D array
        }

    def get_observations(self, lat: float = None, lon: float = None) -> List[Dict]:
        # Return summary of all observations
        res = []
        for obs in self.observations:
            res.append({
                "id": obs["id"],
                "type": obs["type"],
                "latitude": obs["latitude"],
                "longitude": obs["longitude"],
                "timestamp": obs["timestamp"]
            })
        return res

    def get_observation_profile(self, obs_id: str) -> Dict:
        for obs in self.observations:
            if obs["id"] == obs_id:
                return obs
        return {}

    def get_comparison(self, observation_id: str, depth: float) -> Dict:
        obs = self.get_observation_profile(observation_id)
        if not obs or self.ds is None:
            return {}
            
        obs_time = pd.to_datetime(obs["timestamp"]).tz_localize(None)
        lat = obs["latitude"]
        lon = obs["longitude"]
        
        # Get nearest model value
        subset = self.ds.sel(
            latitude=lat, 
            longitude=lon, 
            depth=depth, 
            time=obs_time, 
            method="nearest"
        )
        
        if "temperature" not in subset.data_vars or "salinity" not in subset.data_vars:
            return {}
            
        model_temp = float(subset["temperature"].values)
        model_sal = float(subset["salinity"].values)
        
        # Find matching observation value from profile
        argo_temp = None
        argo_sal = None
        for p in obs.get("profiles", []):
            if p["depth"] == depth:
                argo_temp = p.get("temperature")
                argo_sal = p.get("salinity")
                break
                
        if argo_temp is None or argo_sal is None:
            return {}
            
        temp_diff = float(model_temp - argo_temp)
        sal_diff = float(model_sal - argo_sal)
        
        abs_temp_diff = abs(temp_diff)
        abs_sal_diff = abs(sal_diff)
        
        status = "NORMAL"
        if abs_temp_diff >= 1.0 or abs_sal_diff >= 0.5:
            status = "SIGNIFICANT DEVIATION"
        elif abs_temp_diff >= 0.5 or abs_sal_diff >= 0.2:
            status = "MODERATE DEVIATION"
            
        return {
            "argo_id": observation_id,
            "depth": depth,
            "model_temperature": round(model_temp, 2),
            "argo_temperature": round(argo_temp, 2),
            "temperature_difference": round(temp_diff, 2),
            "model_salinity": round(model_sal, 2),
            "argo_salinity": round(argo_sal, 2),
            "salinity_difference": round(sal_diff, 2),
            "status": status
        }
        
    def get_insight(self, observation_id: str, depth: float) -> Dict:
        comp = self.get_comparison(observation_id, depth)
        if not comp:
            return {}
            
        temp_diff = comp["temperature_difference"]
        abs_temp_diff = abs(temp_diff)
        
        obs = self.get_observation_profile(observation_id)
        region = obs.get("region", "the area") if obs else "the area"
        
        if abs_temp_diff >= 1.0:
            severity = "SIGNIFICANT DEVIATION"
            msg = f"Temperature deviation of {abs_temp_diff}°C detected between the ocean model and {observation_id} at approximately {depth}m depth in the {region}."
        elif abs_temp_diff >= 0.5:
            severity = "MODERATE DEVIATION"
            msg = f"Moderate temperature deviation of {abs_temp_diff}°C detected between the ocean model and {observation_id} at approximately {depth}m depth in the {region}."
        else:
            severity = "NORMAL"
            msg = f"The ocean model is in normal agreement with {observation_id} at {depth}m depth in the {region}."
            
        direction = "warmer" if temp_diff > 0 else "cooler"
        
        if severity != "NORMAL":
            explanation = f"The model is {direction} than the observed ARGO temperature at the selected depth."
        else:
            explanation = "Model and observation are closely matched."
            
        return {
            "argo_id": observation_id,
            "depth": depth,
            "severity": severity,
            "confidence": "High",
            "message": msg,
            "explanation": explanation
        }
