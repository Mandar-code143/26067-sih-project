import os
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from parsers import NetCDFParser, ArgoParser, GliderParser, INCOISSyntheticGenerator

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
NC_FILE = os.path.join(DATA_DIR, "ocean_data.nc")
OBS_FILE = os.path.join(DATA_DIR, "observations.json")
GLIDER_FILE = os.path.join(DATA_DIR, "gliders.json")

class DataService:
    def __init__(self):
        self.model_parser = NetCDFParser()
        self.argo_parser = ArgoParser()
        self.glider_parser = GliderParser()
        self.initialize_data()

    def initialize_data(self):
        """Ensure ocean data files exist or generate physically realistic INCOIS dataset."""
        needs_generation = not (
            os.path.exists(NC_FILE) and 
            os.path.exists(OBS_FILE) and 
            os.path.exists(GLIDER_FILE)
        )

        if needs_generation:
            print("[DataService] Generating realistic INCOIS ocean dataset...")
            INCOISSyntheticGenerator.generate_dataset(
                output_nc_path=NC_FILE,
                output_obs_path=OBS_FILE,
                output_glider_path=GLIDER_FILE
            )

        self.model_parser.load(NC_FILE)
        self.argo_parser.load(OBS_FILE)
        self.glider_parser.load(GLIDER_FILE)
        print("[DataService] Ocean datasets loaded successfully.")

    def get_metadata(self) -> Dict[str, Any]:
        return self.model_parser.get_metadata()

    def get_grid_data(self, variable: str, depth: float, time_str: str) -> Optional[Dict[str, Any]]:
        return self.model_parser.get_grid_slice(variable, depth, time_str)

    def get_grid_binary(self, variable: str, depth: float, time_str: str) -> Optional[Tuple[bytes, Dict[str, Any]]]:
        return self.model_parser.get_grid_binary(variable, depth, time_str)

    def get_volume_binary(self, variable: str, time_str: str) -> Optional[Tuple[bytes, Dict[str, Any]]]:
        return self.model_parser.get_volume_cube(variable, time_str)

    def get_observations(self) -> List[Dict[str, Any]]:
        return self.argo_parser.get_summaries()

    def get_observation_profile(self, obs_id: str) -> Optional[Dict[str, Any]]:
        return self.argo_parser.get_platform_details(obs_id)

    def get_gliders(self) -> List[Dict[str, Any]]:
        return self.glider_parser.get_summaries()

    def get_glider_mission(self, glider_id: str) -> Optional[Dict[str, Any]]:
        return self.glider_parser.get_platform_details(glider_id)

    def get_comparison(self, observation_id: str, depth: float, variable: str = "temperature") -> Optional[Dict[str, Any]]:
        obs = self.get_observation_profile(observation_id)
        if not obs or self.model_parser.ds is None:
            return None

        lat = obs["latitude"]
        lon = obs["longitude"]
        obs_time = pd.to_datetime(obs["timestamp"]).tz_localize(None)

        # Extract complete vertical column from model at observation location
        ds = self.model_parser.ds
        canonical_var = self.model_parser.get_canonical_var_name(variable)
        if not canonical_var or canonical_var not in ds.data_vars:
            return None

        # Sample model at nearest lat/lon/time
        model_col = ds[canonical_var].sel(
            latitude=lat,
            longitude=lon,
            time=obs_time,
            method="nearest"
        )

        model_depths = np.array(self.model_parser.ds[self.model_parser.depth_dim].values, dtype=np.float32)
        model_vals = np.array(model_col.values, dtype=np.float32)

        # Interpolate model value at queried depth level
        model_val = float(np.interp(depth, model_depths, model_vals))

        # Look up observation profile values and interpolate
        profiles = obs.get("profiles", [])
        if not profiles:
            return None

        obs_depths = [p["depth"] for p in profiles if variable in p]
        obs_vals = [p[variable] for p in profiles if variable in p]

        if not obs_depths:
            return None

        obs_val = float(np.interp(depth, obs_depths, obs_vals))
        difference = round(model_val - obs_val, 3)
        abs_diff = abs(difference)

        # Statistical Thresholds based on physical oceanographic standards
        if variable == "temperature":
            sig_thresh, mod_thresh = 1.0, 0.4
            unit = "°C"
        elif variable == "salinity":
            sig_thresh, mod_thresh = 0.4, 0.15
            unit = "PSU"
        elif variable == "chlorophyll":
            sig_thresh, mod_thresh = 0.8, 0.3
            unit = "mg/m³"
        else:
            sig_thresh, mod_thresh = 1.0, 0.5
            unit = ""

        if abs_diff >= sig_thresh:
            severity = "significant"
            status = "SIGNIFICANT DEVIATION"
        elif abs_diff >= mod_thresh:
            severity = "moderate"
            status = "MODERATE DEVIATION"
        else:
            severity = "normal"
            status = "NORMAL CONGRUENCE"

        # Calculate whole-column Root Mean Square Error (RMSE)
        interp_obs_on_model = np.interp(model_depths, obs_depths, obs_vals)
        rmse = float(np.sqrt(np.mean((model_vals - interp_obs_on_model) ** 2)))

        return {
            "observation_id": observation_id,
            "platform_type": obs.get("type", "argo_float"),
            "region": obs.get("region", "Indian Ocean"),
            "depth": depth,
            "variable": variable,
            "unit": unit,
            "model_value": round(model_val, 2),
            "observed_value": round(obs_val, 2),
            "difference": difference,
            "abs_difference": round(abs_diff, 2),
            "column_rmse": round(rmse, 3),
            "severity": severity,
            "status": status,
            "confidence_score": 0.94 if severity == "normal" else 0.88,
            "latitude": lat,
            "longitude": lon,
            "timestamp": obs["timestamp"]
        }

    def get_insight(self, observation_id: str, depth: float) -> Optional[Dict[str, Any]]:
        comp_temp = self.get_comparison(observation_id, depth, "temperature")
        comp_sal = self.get_comparison(observation_id, depth, "salinity")
        if not comp_temp:
            return None

        region = comp_temp.get("region", "the Indian Ocean")
        temp_diff = comp_temp["difference"]
        abs_t = abs(temp_diff)
        severity = comp_temp["severity"]

        direction = "warmer" if temp_diff > 0 else "cooler"

        if severity == "significant":
            msg = (
                f"Subsurface thermal anomaly of {abs_t:.2f}°C detected at {depth}m depth in {region}. "
                f"Numerical model predicts a {direction} water mass compared to in-situ ARGO telemetry."
            )
            explanation = (
                f"Potential causes include unmodeled mesoscale eddy shear, internal wave pycnocline displacement, "
                f"or intense coastal upwelling front dynamics in {region}."
            )
        elif severity == "moderate":
            msg = (
                f"Moderate temperature divergence of {abs_t:.2f}°C observed at {depth}m in {region}. "
                f"Model boundary layer is slightly {direction} than Argo CTD recordings."
            )
            explanation = (
                "Difference falls within standard tropical thermocline variability during seasonal monsoon transition."
            )
        else:
            msg = (
                f"High model-observation concordance at {depth}m depth in {region} (Δ: {abs_t:.2f}°C). "
                "Simulated ocean stratification aligns closely with in-situ profile measurements."
            )
            explanation = "Model physics and Argo profiling float agree within standard observational uncertainty."

        sal_diff_str = f" Salinity deviation: {comp_sal['difference']:.2f} PSU." if comp_sal else ""

        return {
            "argo_id": observation_id,
            "depth": depth,
            "severity": comp_temp["status"],
            "severity_level": severity,
            "confidence": f"{int(comp_temp['confidence_score']*100)}%",
            "message": msg + sal_diff_str,
            "explanation": explanation,
            "column_rmse": comp_temp.get("column_rmse", 0.0)
        }
