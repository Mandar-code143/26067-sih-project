import numpy as np
import pandas as pd
import xarray as xr
import json
import os

# Indian Ocean bounds approximately
lats = np.linspace(-10, 25, 35) # 1 degree resolution
lons = np.linspace(50, 95, 45)
depths = np.array([0, 50, 100, 200, 300, 500])
times = pd.date_range("2026-09-01", "2026-09-10", freq="D")

# Generate mock temperature and salinity
# Temp generally decreases with depth
# Salinity varies slightly

temp_base = np.linspace(28, 12, len(depths))
temp_data = np.zeros((len(times), len(depths), len(lats), len(lons)))
salinity_data = np.zeros((len(times), len(depths), len(lats), len(lons)))

for i, d in enumerate(depths):
    # Base temp for depth + spatial variation + random noise
    t = temp_base[i]
    temp_data[:, i, :, :] = t + np.random.normal(0, 0.5, (len(times), len(lats), len(lons)))
    
    # Base salinity
    salinity_data[:, i, :, :] = 35.0 + np.random.normal(0, 0.2, (len(times), len(lats), len(lons)))

# Create dataset
ds = xr.Dataset(
    {
        "temperature": (["time", "depth", "latitude", "longitude"], temp_data),
        "salinity": (["time", "depth", "latitude", "longitude"], salinity_data),
    },
    coords={
        "time": times,
        "depth": depths,
        "latitude": lats,
        "longitude": lons,
    },
)

# Save to netcdf
ds.to_netcdf("ocean_data.nc")
print("Saved ocean_data.nc")

# Generate mock observations (Argo floats)
observations = []
np.random.seed(42)

for i in range(10):
    lat = np.random.uniform(5, 20)
    lon = np.random.uniform(60, 90)
    
    # Get closest model values to generate realistic observation
    t_idx = np.random.randint(0, len(times))
    time_val = times[t_idx]
    
    profiles = []
    for d_idx, d in enumerate(depths):
        # Retrieve actual model base value + some observation error
        model_t = temp_base[d_idx]
        # Introduce a "moderate" or "significant" anomaly occasionally
        error = np.random.normal(0, 0.3)
        if np.random.random() > 0.8:
            error = np.random.choice([-1.2, 1.2, -0.8, 0.8])
            
        obs_t = model_t + error
        obs_s = 35.0 + np.random.normal(0, 0.1)
        
        profiles.append({
            "depth": int(d),
            "temperature": round(obs_t, 2),
            "salinity": round(obs_s, 2)
        })
        
    obs = {
        "id": f"ARGO-10{i}",
        "type": "argo",
        "latitude": round(lat, 2),
        "longitude": round(lon, 2),
        "timestamp": time_val.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "profiles": profiles
    }
    observations.append(obs)

with open("mock_observations.json", "w") as f:
    json.dump(observations, f, indent=2)

print("Saved mock_observations.json")
