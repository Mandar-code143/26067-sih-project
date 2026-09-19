import xarray as xr
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from .base import BaseOceanDataParser

class NetCDFParser(BaseOceanDataParser):
    """
    Robust CF-Convention & Multi-Grid NetCDF Parser.
    Handles standard ocean model files from INCOIS, Copernicus Marine, MOM6, NEMO, ROMS, HYCOM.
    """

    LAT_CANDIDATES = ["latitude", "lat", "nav_lat", "lat_rho", "lat_u", "lat_v", "y"]
    LON_CANDIDATES = ["longitude", "lon", "nav_lon", "lon_rho", "lon_u", "lon_v", "x"]
    DEPTH_CANDIDATES = ["depth", "deptht", "lev", "level", "z", "depth_u", "depth_v", "s_rho"]
    TIME_CANDIDATES = ["time", "time_counter", "ocean_time", "times"]

    VARIABLE_REGISTRY = {
        "temperature": {
            "names": ["temperature", "temp", "thetao", "votemper", "pot_temp"],
            "standard_name": "Potential Temperature",
            "unit": "°C",
            "palette": "thermal",
            "range": [2.0, 32.0]
        },
        "salinity": {
            "names": ["salinity", "sal", "so", "vosaline", "practical_salinity"],
            "standard_name": "Practical Salinity",
            "unit": "PSU",
            "palette": "haline",
            "range": [30.0, 37.0]
        },
        "u_current": {
            "names": ["u_current", "uo", "vozocrtx", "u", "u_eastward"],
            "standard_name": "Zonal Velocity (Eastward)",
            "unit": "m/s",
            "palette": "balance",
            "range": [-1.5, 1.5]
        },
        "v_current": {
            "names": ["v_current", "vo", "vomecrty", "v", "v_northward"],
            "standard_name": "Meridional Velocity (Northward)",
            "unit": "m/s",
            "palette": "balance",
            "range": [-1.5, 1.5]
        },
        "w_current": {
            "names": ["w_current", "wo", "vovecrtz", "w"],
            "standard_name": "Vertical Velocity",
            "unit": "m/s",
            "palette": "delta",
            "range": [-0.05, 0.05]
        },
        "chlorophyll": {
            "names": ["chlorophyll", "chl", "chla", "mass_concentration_of_chlorophyll_a_in_sea_water"],
            "standard_name": "Chlorophyll-a",
            "unit": "mg/m³",
            "palette": "algae",
            "range": [0.01, 5.0]
        },
        "dissolved_oxygen": {
            "names": ["dissolved_oxygen", "o2", "doxy", "oxygen"],
            "standard_name": "Dissolved Oxygen",
            "unit": "ml/l",
            "palette": "dense",
            "range": [0.0, 6.0]
        }
    }

    def __init__(self):
        self.ds: Optional[xr.Dataset] = None
        self.lat_dim: Optional[str] = None
        self.lon_dim: Optional[str] = None
        self.depth_dim: Optional[str] = None
        self.time_dim: Optional[str] = None

    def load(self, source: str) -> bool:
        try:
            self.ds = xr.open_dataset(source)
            self._discover_dimensions()
            return True
        except Exception as e:
            print(f"[NetCDFParser] Error opening dataset {source}: {e}")
            return False

    def _discover_dimensions(self):
        if self.ds is None:
            return

        all_coords_and_dims = list(self.ds.coords.keys()) + list(self.ds.sizes.keys())

        for cand in self.LAT_CANDIDATES:
            if cand in all_coords_and_dims:
                self.lat_dim = cand
                break

        for cand in self.LON_CANDIDATES:
            if cand in all_coords_and_dims:
                self.lon_dim = cand
                break

        for cand in self.DEPTH_CANDIDATES:
            if cand in all_coords_and_dims:
                self.depth_dim = cand
                break

        for cand in self.TIME_CANDIDATES:
            if cand in all_coords_and_dims:
                self.time_dim = cand
                break

    def get_canonical_var_name(self, var_id: str) -> Optional[str]:
        if self.ds is None:
            return None
            
        if var_id in self.ds.data_vars:
            return var_id

        if var_id in self.VARIABLE_REGISTRY:
            for alias in self.VARIABLE_REGISTRY[var_id]["names"]:
                if alias in self.ds.data_vars:
                    return alias
                    
        return None

    def get_metadata(self) -> Dict[str, Any]:
        if self.ds is None:
            return {}

        lats = self.ds[self.lat_dim].values if self.lat_dim else np.array([])
        lons = self.ds[self.lon_dim].values if self.lon_dim else np.array([])
        depths = self.ds[self.depth_dim].values if self.depth_dim else np.array([0.0])
        times = self.ds[self.time_dim].values if self.time_dim else np.array([])

        discovered_vars = []
        for v_id, meta in self.VARIABLE_REGISTRY.items():
            if self.get_canonical_var_name(v_id):
                discovered_vars.append({
                    "id": v_id,
                    "name": meta["standard_name"],
                    "unit": meta["unit"],
                    "palette": meta["palette"],
                    "default_range": meta["range"]
                })

        return {
            "title": self.ds.attrs.get("title", "INCOIS Numerical Ocean Model"),
            "institution": self.ds.attrs.get("institution", "INCOIS, Hyderabad"),
            "geographic_bounds": {
                "lat_min": float(np.min(lats)) if len(lats) else 0.0,
                "lat_max": float(np.max(lats)) if len(lats) else 0.0,
                "lon_min": float(np.min(lons)) if len(lons) else 0.0,
                "lon_max": float(np.max(lons)) if len(lons) else 0.0,
            },
            "grid_shape": {
                "lat_count": len(lats),
                "lon_count": len(lons),
                "depth_count": len(depths),
                "time_count": len(times)
            },
            "available_depths": [float(d) for d in depths],
            "available_timestamps": [str(pd.to_datetime(t)) for t in times],
            "variables": discovered_vars
        }

    def get_grid_slice(self, variable: str, depth: float, timestamp: str) -> Optional[Dict[str, Any]]:
        if self.ds is None:
            return None

        canonical_var = self.get_canonical_var_name(variable)
        if not canonical_var:
            return None

        time_val = pd.to_datetime(timestamp).tz_localize(None)

        sel_kwargs = {}
        if self.time_dim and self.time_dim in self.ds[canonical_var].dims:
            sel_kwargs[self.time_dim] = time_val
        if self.depth_dim and self.depth_dim in self.ds[canonical_var].dims:
            sel_kwargs[self.depth_dim] = depth

        subset = self.ds[canonical_var].sel(**sel_kwargs, method="nearest")

        arr = np.nan_to_num(subset.values.astype(np.float32), nan=-999.0)
        lats = [float(x) for x in self.ds[self.lat_dim].values] if self.lat_dim else []
        lons = [float(x) for x in self.ds[self.lon_dim].values] if self.lon_dim else []

        valid_data = arr[arr != -999.0]
        val_min = float(np.min(valid_data)) if len(valid_data) > 0 else 0.0
        val_max = float(np.max(valid_data)) if len(valid_data) > 0 else 1.0

        return {
            "variable": variable,
            "depth": float(subset[self.depth_dim].values) if self.depth_dim and self.depth_dim in subset.coords else depth,
            "timestamp": str(subset[self.time_dim].values) if self.time_dim and self.time_dim in subset.coords else timestamp,
            "lats": lats,
            "lons": lons,
            "shape": list(arr.shape),
            "min_value": val_min,
            "max_value": val_max,
            "data": arr.tolist()
        }

    def get_grid_binary(self, variable: str, depth: float, timestamp: str) -> Optional[Tuple[bytes, Dict[str, Any]]]:
        """Extract a 2D spatial grid slice as raw little-endian Float32 bytes."""
        if self.ds is None:
            return None

        canonical_var = self.get_canonical_var_name(variable)
        if not canonical_var:
            return None

        time_val = pd.to_datetime(timestamp).tz_localize(None)

        sel_kwargs = {}
        if self.time_dim and self.time_dim in self.ds[canonical_var].dims:
            sel_kwargs[self.time_dim] = time_val
        if self.depth_dim and self.depth_dim in self.ds[canonical_var].dims:
            sel_kwargs[self.depth_dim] = depth

        subset = self.ds[canonical_var].sel(**sel_kwargs, method="nearest")
        arr = np.nan_to_num(subset.values.astype(np.float32), nan=-999.0)

        # Flatten array as contiguous C float32 buffer
        byte_data = arr.astype('<f4').tobytes()

        lats = self.ds[self.lat_dim].values if self.lat_dim else np.array([])
        lons = self.ds[self.lon_dim].values if self.lon_dim else np.array([])

        valid_data = arr[arr != -999.0]
        meta = {
            "variable": variable,
            "depth": float(subset[self.depth_dim].values) if self.depth_dim and self.depth_dim in subset.coords else depth,
            "lat_min": float(np.min(lats)),
            "lat_max": float(np.max(lats)),
            "lon_min": float(np.min(lons)),
            "lon_max": float(np.max(lons)),
            "rows": int(arr.shape[0]),
            "cols": int(arr.shape[1]),
            "min_value": float(np.min(valid_data)) if len(valid_data) > 0 else 0.0,
            "max_value": float(np.max(valid_data)) if len(valid_data) > 0 else 1.0,
        }
        return byte_data, meta

    def get_volume_cube(self, variable: str, timestamp: str) -> Optional[Tuple[bytes, Dict[str, Any]]]:
        """Extract a 3D (depth, lat, lon) array for volumetric rendering."""
        if self.ds is None:
            return None

        canonical_var = self.get_canonical_var_name(variable)
        if not canonical_var:
            return None

        time_val = pd.to_datetime(timestamp).tz_localize(None)

        sel_kwargs = {}
        if self.time_dim and self.time_dim in self.ds[canonical_var].dims:
            sel_kwargs[self.time_dim] = time_val

        subset = self.ds[canonical_var].sel(**sel_kwargs, method="nearest")
        arr = np.nan_to_num(subset.values.astype(np.float32), nan=-999.0)

        byte_data = arr.astype('<f4').tobytes()
        valid_data = arr[arr != -999.0]

        meta = {
            "variable": variable,
            "shape": list(arr.shape),  # [depth_layers, lat_rows, lon_cols]
            "min_value": float(np.min(valid_data)) if len(valid_data) > 0 else 0.0,
            "max_value": float(np.max(valid_data)) if len(valid_data) > 0 else 1.0,
            "depths": [float(d) for d in self.ds[self.depth_dim].values] if self.depth_dim else [0.0]
        }
        return byte_data, meta
