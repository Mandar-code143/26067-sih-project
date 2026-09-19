import numpy as np
import pandas as pd
import xarray as xr
import json
import os
from typing import Dict, Any, List, Tuple

class INCOISSyntheticGenerator:
    """
    Realistic Ocean Hydrodynamic & Biogeochemical Model Data Generator.
    Follows CF-1.6 conventions and models realistic Indian Ocean / Arabian Sea / Bay of Bengal phenomena:
    - Arabian Sea high salinity & northern Bay of Bengal river discharge low salinity
    - Tropical warm pool & southwest monsoon coastal upwelling (Malabar & Somali)
    - Sub-surface oxygen minimum zone (OMZ) and Deep Chlorophyll Maximum (DCM)
    - Mesoscale cyclonic/anticyclonic geostrophic eddies and coastal current vectors (u, v, w)
    """

    @staticmethod
    def generate_dataset(
        output_nc_path: str,
        output_obs_path: str,
        output_glider_path: str
    ) -> Tuple[xr.Dataset, List[Dict[str, Any]], List[Dict[str, Any]]]:
        np.random.seed(42)

        # Coordinate Grids (Indian Ocean EEZ Focus)
        lats = np.linspace(-15.0, 28.0, 44)  # ~1.0 degree grid
        lons = np.linspace(45.0, 100.0, 56)
        depths = np.array([0, 10, 25, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000], dtype=np.float32)
        times = pd.date_range("2026-09-01", "2026-09-10", freq="D")
        
        n_times = len(times)
        n_depths = len(depths)
        n_lats = len(lats)
        n_lons = len(lons)

        lon_grid, lat_grid = np.meshgrid(lons, lats)

        # Initialize 4D fields (time, depth, lat, lon)
        temp_data = np.zeros((n_times, n_depths, n_lats, n_lons), dtype=np.float32)
        sal_data = np.zeros((n_times, n_depths, n_lats, n_lons), dtype=np.float32)
        u_data = np.zeros((n_times, n_depths, n_lats, n_lons), dtype=np.float32)
        v_data = np.zeros((n_times, n_depths, n_lats, n_lons), dtype=np.float32)
        w_data = np.zeros((n_times, n_depths, n_lats, n_lons), dtype=np.float32)
        chl_data = np.zeros((n_times, n_depths, n_lats, n_lons), dtype=np.float32)
        o2_data = np.zeros((n_times, n_depths, n_lats, n_lons), dtype=np.float32)

        # Base Physical Dynamics
        for t_idx in range(n_times):
            time_phase = t_idx * 0.2
            
            # Mesoscale Eddies (Cyclonic in BOB, Anticyclonic in AS)
            eddy_bob = np.exp(-((lon_grid - 88.0)**2 + (lat_grid - 14.0)**2) / 12.0)
            eddy_as = np.exp(-((lon_grid - 65.0)**2 + (lat_grid - 16.0)**2) / 16.0)
            upwelling_sw = np.exp(-((lon_grid - 74.0)**2 + (lat_grid - 10.0)**2) / 6.0)
            river_plume = np.exp(-((lon_grid - 89.0)**2 + (lat_grid - 21.0)**2) / 10.0)

            for d_idx, depth_m in enumerate(depths):
                # 1. Temperature: Exponential thermocline decay from ~29.5°C at surface to ~2.5°C at 2000m
                thermocline = 2.0 + 27.5 * np.exp(-depth_m / 280.0)
                # Spatial modulation: Warm pool in Bay of Bengal, colder in southern Indian Ocean & upwelling zones
                temp_spatial = (
                    thermocline 
                    + 1.5 * np.sin(np.radians(lat_grid + 10)) 
                    + 0.8 * np.sin(np.radians(lon_grid - 60))
                    - 2.8 * upwelling_sw * np.exp(-depth_m / 120.0)
                    + 1.2 * eddy_bob * np.exp(-depth_m / 200.0)
                    + 0.15 * np.sin(time_phase + lat_grid * 0.1)
                )
                temp_data[t_idx, d_idx, :, :] = temp_spatial + np.random.normal(0, 0.08, (n_lats, n_lons))

                # 2. Salinity: High in Arabian Sea (evaporation ~36.5 PSU), Low in BoB (river runoff ~31.0 PSU)
                sal_base = 34.6 + (0.8 * (lon_grid < 77.0)) - (1.2 * (lon_grid >= 78.0))
                sal_spatial = (
                    sal_base
                    - 3.5 * river_plume * np.exp(-depth_m / 60.0)
                    + 1.2 * eddy_as * np.exp(-depth_m / 150.0)
                    + (depth_m > 500) * 0.2
                )
                sal_data[t_idx, d_idx, :, :] = sal_spatial + np.random.normal(0, 0.04, (n_lats, n_lons))

                # 3. Vector Currents (u: zonal, v: meridional, w: vertical)
                # Attenuate with depth
                depth_factor = np.exp(-depth_m / 200.0)
                # Coastal boundary currents & eddy circulation
                u_eddy = -(lat_grid - 14.0) * eddy_bob * 0.35 + (lat_grid - 16.0) * eddy_as * 0.25
                v_eddy = (lon_grid - 88.0) * eddy_bob * 0.35 - (lon_grid - 65.0) * eddy_as * 0.25
                
                # Southwest Monsoon drift
                u_curr = (0.45 + 0.15 * np.sin(np.radians(lat_grid * 3))) * depth_factor + u_eddy
                v_curr = (0.20 * np.cos(np.radians(lon_grid * 2))) * depth_factor + v_eddy
                w_curr = (0.015 * upwelling_sw - 0.008 * eddy_as) * depth_factor
                
                u_data[t_idx, d_idx, :, :] = u_curr + np.random.normal(0, 0.02, (n_lats, n_lons))
                v_data[t_idx, d_idx, :, :] = v_curr + np.random.normal(0, 0.02, (n_lats, n_lons))
                w_data[t_idx, d_idx, :, :] = w_curr

                # 4. Biogeochemical - Chlorophyll-a (mg/m^3): Subsurface Deep Chlorophyll Max (DCM) around 40-75m
                dcm_profile = np.exp(-((depth_m - 55.0) / 35.0)**2)
                chl_surface = 0.15 + 2.2 * upwelling_sw * np.exp(-depth_m / 40.0) + 1.8 * river_plume * np.exp(-depth_m / 30.0)
                chl_val = chl_surface + 1.2 * dcm_profile
                chl_data[t_idx, d_idx, :, :] = np.clip(chl_val + np.random.normal(0, 0.03, (n_lats, n_lons)), 0.01, 8.0)

                # 5. Biogeochemical - Dissolved Oxygen (ml/l): Surface saturated (~4.8), severe OMZ (0.2 - 0.8) at 150-600m
                omz_dip = 3.5 * np.exp(-((depth_m - 300.0) / 220.0)**2)
                o2_val = 4.8 - omz_dip + 0.5 * (depth_m > 1000)
                o2_data[t_idx, d_idx, :, :] = np.clip(o2_val + np.random.normal(0, 0.05, (n_lats, n_lons)), 0.1, 6.5)

        # Build CF-compliant Xarray Dataset
        ds = xr.Dataset(
            {
                "temperature": (["time", "depth", "latitude", "longitude"], temp_data, {
                    "standard_name": "sea_water_potential_temperature",
                    "long_name": "Potential Temperature",
                    "units": "°C",
                    "_FillValue": -999.0
                }),
                "salinity": (["time", "depth", "latitude", "longitude"], sal_data, {
                    "standard_name": "sea_water_practical_salinity",
                    "long_name": "Practical Salinity",
                    "units": "PSU",
                    "_FillValue": -999.0
                }),
                "u_current": (["time", "depth", "latitude", "longitude"], u_data, {
                    "standard_name": "eastward_sea_water_velocity",
                    "long_name": "Eastward Ocean Current Velocity",
                    "units": "m/s",
                    "_FillValue": -999.0
                }),
                "v_current": (["time", "depth", "latitude", "longitude"], v_data, {
                    "standard_name": "northward_sea_water_velocity",
                    "long_name": "Northward Ocean Current Velocity",
                    "units": "m/s",
                    "_FillValue": -999.0
                }),
                "w_current": (["time", "depth", "latitude", "longitude"], w_data, {
                    "standard_name": "upward_sea_water_velocity",
                    "long_name": "Vertical Ocean Current Velocity",
                    "units": "m/s",
                    "_FillValue": -999.0
                }),
                "chlorophyll": (["time", "depth", "latitude", "longitude"], chl_data, {
                    "standard_name": "mass_concentration_of_chlorophyll_a_in_sea_water",
                    "long_name": "Chlorophyll-a Concentration",
                    "units": "mg/m³",
                    "_FillValue": -999.0
                }),
                "dissolved_oxygen": (["time", "depth", "latitude", "longitude"], o2_data, {
                    "standard_name": "volume_fraction_of_oxygen_in_sea_water",
                    "long_name": "Dissolved Oxygen",
                    "units": "ml/l",
                    "_FillValue": -999.0
                })
            },
            coords={
                "time": times,
                "depth": ("depth", depths, {"units": "m", "positive": "down"}),
                "latitude": ("latitude", lats, {"units": "degrees_north"}),
                "longitude": ("longitude", lons, {"units": "degrees_east"})
            },
            attrs={
                "title": "INCOIS High-Resolution Numerical Ocean Model Analysis",
                "institution": "Indian National Centre for Ocean Information Services (INCOIS)",
                "source": "MOM6-OASIS Ocean Circulation Model & BGC Simulation",
                "Conventions": "CF-1.6",
                "references": "https://incois.gov.in"
            }
        )

        # Write to NetCDF
        ds.to_netcdf(output_nc_path)

        # Generate In-Situ Argo Profiling Float Network (12 Floats across key basins)
        argo_platforms = [
            {"id": "INCOIS-ARGO-2902341", "region": "Arabian Sea (Central)", "base_lat": 15.2, "base_lon": 64.5, "wmo": "2902341", "sensor": "BGC-Argo (SBE41CP + Aanderaa O2 + EcoFLBB)"},
            {"id": "INCOIS-ARGO-2902342", "region": "Arabian Sea (Upwelling/Malabar)", "base_lat": 10.5, "base_lon": 72.8, "wmo": "2902342", "sensor": "Core-Argo (CTD Profiler)"},
            {"id": "INCOIS-ARGO-2902343", "region": "Bay of Bengal (Northern Plume)", "base_lat": 19.8, "base_lon": 88.5, "wmo": "2902343", "sensor": "BGC-Argo (CTD + Chlorophyll)"},
            {"id": "INCOIS-ARGO-2902344", "region": "Bay of Bengal (Central Eddy)", "base_lat": 14.1, "base_lon": 87.2, "wmo": "2902344", "sensor": "BGC-Argo"},
            {"id": "INCOIS-ARGO-2902345", "region": "Equatorial Indian Ocean", "base_lat": 0.5, "base_lon": 78.0, "wmo": "2902345", "sensor": "Deep-Argo (4000m CTD)"},
            {"id": "INCOIS-ARGO-2902346", "region": "Somali Current / Western AS", "base_lat": 8.5, "base_lon": 53.0, "wmo": "2902346", "sensor": "Core-Argo"},
            {"id": "INCOIS-ARGO-2902347", "region": "Andaman Sea", "base_lat": 11.2, "base_lon": 93.5, "wmo": "2902347", "sensor": "Core-Argo"},
            {"id": "INCOIS-ARGO-2902348", "region": "South-Central Indian Ocean", "base_lat": -8.5, "base_lon": 82.0, "wmo": "2902348", "sensor": "Deep-Argo"},
            {"id": "INCOIS-ARGO-2902349", "region": "Lakshadweep Basin", "base_lat": 11.8, "base_lon": 71.5, "wmo": "2902349", "sensor": "Core-Argo"},
            {"id": "INCOIS-ARGO-2902350", "region": "East India Coastal Current (EICC)", "base_lat": 16.5, "base_lon": 83.2, "wmo": "2902350", "sensor": "BGC-Argo"},
            {"id": "INCOIS-ARGO-2902351", "region": "Sri Lanka Dome", "base_lat": 7.2, "base_lon": 84.0, "wmo": "2902351", "sensor": "Core-Argo"},
            {"id": "INCOIS-ARGO-2902352", "region": "Southern Tropical Gyre", "base_lat": -12.0, "base_lon": 65.0, "wmo": "2902352", "sensor": "Core-Argo"}
        ]

        observations = []
        for p in argo_platforms:
            lat = p["base_lat"] + np.random.uniform(-0.4, 0.4)
            lon = p["base_lon"] + np.random.uniform(-0.4, 0.4)
            time_str = "2026-09-08T12:00:00Z"

            # Sample model with realistic observation noise and occasional front anomalies
            profiles = []
            has_anomaly = np.random.rand() > 0.65
            anomaly_mag = np.random.choice([-1.4, 1.3, -0.9, 1.1]) if has_anomaly else 0.0

            for d in depths:
                depth_val = float(d)
                # Model baseline lookup
                m_temp = float(ds.sel(latitude=lat, longitude=lon, depth=depth_val, time="2026-09-08", method="nearest")["temperature"].values)
                m_sal = float(ds.sel(latitude=lat, longitude=lon, depth=depth_val, time="2026-09-08", method="nearest")["salinity"].values)
                m_chl = float(ds.sel(latitude=lat, longitude=lon, depth=depth_val, time="2026-09-08", method="nearest")["chlorophyll"].values)
                m_o2 = float(ds.sel(latitude=lat, longitude=lon, depth=depth_val, time="2026-09-08", method="nearest")["dissolved_oxygen"].values)

                # Add sensor noise and subsurface anomalies
                obs_t = m_temp + (anomaly_mag * np.exp(-depth_val / 200.0)) + np.random.normal(0, 0.05)
                obs_s = m_sal + (anomaly_mag * 0.25 * np.exp(-depth_val / 150.0)) + np.random.normal(0, 0.02)
                obs_chl = m_chl + np.random.normal(0, 0.03)
                obs_o2 = m_o2 + np.random.normal(0, 0.04)

                profiles.append({
                    "depth": depth_val,
                    "temperature": round(obs_t, 2),
                    "salinity": round(obs_s, 2),
                    "chlorophyll": round(max(0.01, obs_chl), 3),
                    "dissolved_oxygen": round(max(0.05, obs_o2), 2),
                    "qc_flag": 1  # 1 = Good data (Argo standard)
                })

            # Historical drift track (last 5 surface fixes)
            drift_track = []
            for step in range(5, 0, -1):
                drift_track.append({
                    "latitude": round(lat - step * 0.08, 3),
                    "longitude": round(lon - step * 0.06, 3),
                    "cycle_number": 120 - step,
                    "timestamp": f"2026-09-0{9-step}T12:00:00Z"
                })

            obs_record = {
                "id": p["id"],
                "type": "argo_float",
                "wmo": p["wmo"],
                "sensor": p["sensor"],
                "region": p["region"],
                "latitude": round(lat, 3),
                "longitude": round(lon, 3),
                "timestamp": time_str,
                "profiles": profiles,
                "trajectory": drift_track
            }
            observations.append(obs_record)

        with open(output_obs_path, "w") as f:
            json.dump(observations, f, indent=2)

        # Generate Autonomous Underwater Glider Missions (Sawtooth 3D depth-resolved transects)
        gliders = [
            {
                "id": "INCOIS-GLIDER-SLOCUM-01",
                "mission_name": "Arabian Sea OMZ High-Res Transect",
                "platform_type": "Teledyne Webb Slocum G3",
                "region": "Arabian Sea Shelf-Break",
                "start_point": {"latitude": 15.0, "longitude": 71.0},
                "end_point": {"latitude": 16.5, "longitude": 68.0},
                "status": "Active Mission",
                "waypoints": []
            },
            {
                "id": "INCOIS-GLIDER-SEAGLIDER-02",
                "mission_name": "Bay of Bengal Fresh Plume & Eddy Transect",
                "platform_type": "Kongsberg Seaglider 1000m",
                "region": "Northern Bay of Bengal",
                "start_point": {"latitude": 18.0, "longitude": 87.0},
                "end_point": {"latitude": 15.5, "longitude": 89.5},
                "status": "Active Mission",
                "waypoints": []
            }
        ]

        for g in gliders:
            n_dives = 18
            lats_transect = np.linspace(g["start_point"]["latitude"], g["end_point"]["latitude"], n_dives * 10)
            lons_transect = np.linspace(g["start_point"]["longitude"], g["end_point"]["longitude"], n_dives * 10)
            
            # Sawtooth trajectory: depth oscillates between 0m and 1000m
            for idx in range(len(lats_transect)):
                phase = (idx % 20) / 20.0
                dive_depth = 1000.0 * (2.0 * phase if phase <= 0.5 else 2.0 * (1.0 - phase))
                
                cur_lat = float(lats_transect[idx])
                cur_lon = float(lons_transect[idx])
                
                # Fetch baseline model value
                m_temp = float(ds.sel(latitude=cur_lat, longitude=cur_lon, depth=dive_depth, time="2026-09-08", method="nearest")["temperature"].values)
                m_sal = float(ds.sel(latitude=cur_lat, longitude=cur_lon, depth=dive_depth, time="2026-09-08", method="nearest")["salinity"].values)
                m_chl = float(ds.sel(latitude=cur_lat, longitude=cur_lon, depth=dive_depth, time="2026-09-08", method="nearest")["chlorophyll"].values)

                g["waypoints"].append({
                    "seq": idx,
                    "latitude": round(cur_lat, 4),
                    "longitude": round(cur_lon, 4),
                    "depth": round(dive_depth, 1),
                    "temperature": round(m_temp + np.random.normal(0, 0.04), 2),
                    "salinity": round(m_sal + np.random.normal(0, 0.02), 2),
                    "chlorophyll": round(max(0.01, m_chl + np.random.normal(0, 0.02)), 3),
                    "timestamp": f"2026-09-08T{idx:02d}:00:00Z"
                })

        with open(output_glider_path, "w") as f:
            json.dump(gliders, f, indent=2)

        return ds, observations, gliders
