from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from data_service import DataService

app = FastAPI(title="Ocean Insight API")

# Setup CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ds = DataService()

@app.get("/api/health")
def get_health():
    return {"status": "ok"}

@app.get("/api/variables")
def get_variables():
    return {
        "variables": [
            {
                "id": "temperature",
                "name": "Temperature",
                "unit": "°C"
            },
            {
                "id": "salinity",
                "name": "Salinity",
                "unit": "PSU"
            }
        ]
    }

@app.get("/api/model/metadata")
def get_metadata():
    return ds.get_metadata()

@app.get("/api/model/grid")
def get_model_grid(variable: str, depth: float, time: str):
    data = ds.get_grid_data(variable, depth, time)
    if not data:
        raise HTTPException(status_code=404, detail="Data unavailable for requested parameters")
    return data

@app.get("/api/observations")
def get_observations(
    lat: Optional[float] = None, 
    lon: Optional[float] = None, 
    start_time: Optional[str] = None
):
    return ds.get_observations(lat, lon)

@app.get("/api/observations/{id}")
def get_observation_profile(id: str):
    data = ds.get_observation_profile(id)
    if not data:
        raise HTTPException(status_code=404, detail="Observation not found")
    return data

@app.get("/api/comparison/{id}")
def get_comparison(id: str, variable: str, depth: float):
    data = ds.get_comparison(id, depth)
    if not data:
        raise HTTPException(status_code=404, detail="Comparison unavailable")
    
    severity = "normal"
    if data["status"] == "SIGNIFICANT DEVIATION":
        severity = "significant"
    elif data["status"] == "MODERATE DEVIATION":
        severity = "moderate"
        
    return {
        "model_value": data[f"model_{variable}"],
        "observed_value": data[f"argo_{variable}"],
        "difference": data[f"{variable}_difference"],
        "severity": severity,
        "observation_id": id,
        "variable": variable,
        "depth": depth,
        "model_salinity": data["model_salinity"],
        "argo_salinity": data["argo_salinity"],
        "salinity_difference": data["salinity_difference"],
        "model_temperature": data["model_temperature"],
        "argo_temperature": data["argo_temperature"],
        "temperature_difference": data["temperature_difference"],
    }

@app.get("/api/insights/{id}")
def get_insights(id: str, depth: float):
    data = ds.get_insight(id, depth)
    if not data:
        raise HTTPException(status_code=404, detail="Insight unavailable")
    return data

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
