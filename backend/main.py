from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import json
from data_service import DataService

app = FastAPI(
    title="INCOIS 3D Ocean Intelligence Platform API",
    description="High-Performance REST & Binary Streaming API for Ocean Numerical Models & In-Situ Observations (Argo & Gliders)",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Grid-Rows", "X-Grid-Cols", 
        "X-Lat-Min", "X-Lat-Max", 
        "X-Lon-Min", "X-Lon-Max", 
        "X-Data-Min", "X-Data-Max", 
        "X-Depth", "X-Variable",
        "X-Volume-Shape"
    ]
)

ds = DataService()

@app.get("/api/health")
def get_health():
    return {
        "status": "operational",
        "service": "INCOIS 3D Ocean Data Engine",
        "version": "2.0.0"
    }

@app.get("/api/variables")
def get_variables():
    meta = ds.get_metadata()
    return {
        "variables": meta.get("variables", [])
    }

@app.get("/api/model/metadata")
def get_metadata():
    return ds.get_metadata()

@app.get("/api/model/grid")
def get_model_grid(
    variable: str = Query(..., description="Variable identifier (temperature, salinity, u_current, etc.)"),
    depth: float = Query(0.0, description="Depth in meters"),
    time: str = Query("2026-09-08T12:00:00", description="Timestamp ISO string")
):
    data = ds.get_grid_data(variable, depth, time)
    if not data:
        raise HTTPException(status_code=404, detail="Grid data unavailable for requested parameters")
    return data

@app.get("/api/model/grid/binary")
def get_model_grid_binary(
    variable: str = Query(..., description="Variable identifier"),
    depth: float = Query(0.0, description="Depth in meters"),
    time: str = Query("2026-09-08T12:00:00", description="Timestamp ISO string")
):
    """
    High-speed binary Float32Array streaming endpoint for WebGL & Deck.gl ingestion.
    Returns 4-byte little-endian IEEE 754 floats directly.
    """
    result = ds.get_grid_binary(variable, depth, time)
    if not result:
        raise HTTPException(status_code=404, detail="Binary grid data unavailable for requested parameters")
    
    raw_bytes, meta = result
    headers = {
        "X-Grid-Rows": str(meta["rows"]),
        "X-Grid-Cols": str(meta["cols"]),
        "X-Lat-Min": str(meta["lat_min"]),
        "X-Lat-Max": str(meta["lat_max"]),
        "X-Lon-Min": str(meta["lon_min"]),
        "X-Lon-Max": str(meta["lon_max"]),
        "X-Data-Min": str(meta["min_value"]),
        "X-Data-Max": str(meta["max_value"]),
        "X-Depth": str(meta["depth"]),
        "X-Variable": str(meta["variable"]),
    }
    return Response(content=raw_bytes, media_type="application/octet-stream", headers=headers)

@app.get("/api/model/volume/binary")
def get_model_volume_binary(
    variable: str = Query(..., description="Variable identifier"),
    time: str = Query("2026-09-08T12:00:00", description="Timestamp ISO string")
):
    """
    Volumetric 3D (depth, lat, lon) Float32 binary streaming endpoint for volumetric shader / raymarching.
    """
    result = ds.get_volume_binary(variable, time)
    if not result:
        raise HTTPException(status_code=404, detail="Volumetric data unavailable")
    
    raw_bytes, meta = result
    headers = {
        "X-Volume-Shape": json.dumps(meta["shape"]),
        "X-Data-Min": str(meta["min_value"]),
        "X-Data-Max": str(meta["max_value"]),
        "X-Depths": json.dumps(meta["depths"]),
        "X-Variable": str(meta["variable"]),
    }
    return Response(content=raw_bytes, media_type="application/octet-stream", headers=headers)

@app.get("/api/observations")
def get_observations():
    """Retrieve all Argo profiling float positions & summaries."""
    return ds.get_observations()

@app.get("/api/observations/gliders")
def get_gliders():
    """Retrieve all active autonomous underwater glider missions."""
    return ds.get_gliders()

@app.get("/api/observations/gliders/{glider_id}")
def get_glider_mission(glider_id: str):
    """Retrieve full 3D sawtooth diving profile and mission waypoints for a glider."""
    data = ds.get_glider_mission(glider_id)
    if not data:
        raise HTTPException(status_code=404, detail="Glider mission not found")
    return data

@app.get("/api/observations/{obs_id}")
def get_observation_profile(obs_id: str):
    """Retrieve detailed vertical multi-parameter profile & drift trajectory for an observation platform."""
    data = ds.get_observation_profile(obs_id)
    if not data:
        raise HTTPException(status_code=404, detail="Observation not found")
    return data

@app.get("/api/comparison/{obs_id}")
def get_comparison(
    obs_id: str, 
    variable: str = Query("temperature", description="Variable to compare"),
    depth: float = Query(100.0, description="Depth level in meters")
):
    """Depth-interpolated statistical model vs observation congruence analysis."""
    data = ds.get_comparison(obs_id, depth, variable)
    if not data:
        raise HTTPException(status_code=404, detail="Comparison unavailable for parameters")
    return data

@app.get("/api/insights/{obs_id}")
def get_insights(obs_id: str, depth: float = Query(100.0)):
    """Oceanographic anomaly insights, explanation & confidence metrics."""
    data = ds.get_insight(obs_id, depth)
    if not data:
        raise HTTPException(status_code=404, detail="Insight unavailable for parameters")
    return data

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
