from fastapi.testclient import TestClient
import numpy as np
from main import app

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "operational"
    print("[PASS] /api/health passed")

def test_variables():
    response = client.get("/api/variables")
    assert response.status_code == 200
    vars = response.json()["variables"]
    var_ids = [v["id"] for v in vars]
    assert "temperature" in var_ids
    assert "salinity" in var_ids
    assert "u_current" in var_ids
    assert "chlorophyll" in var_ids
    assert "dissolved_oxygen" in var_ids
    print(f"[PASS] /api/variables passed ({len(vars)} variables discovered)")

def test_metadata():
    response = client.get("/api/model/metadata")
    assert response.status_code == 200
    data = response.json()
    assert "geographic_bounds" in data
    assert len(data["available_depths"]) >= 10
    assert len(data["available_timestamps"]) >= 5
    print("[PASS] /api/model/metadata passed")

def test_binary_grid():
    response = client.get("/api/model/grid/binary?variable=temperature&depth=100&time=2026-09-08T12:00:00")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/octet-stream"
    
    rows = int(response.headers["x-grid-rows"])
    cols = int(response.headers["x-grid-cols"])
    raw_bytes = response.content
    
    # Float32 is 4 bytes per element
    expected_len = rows * cols * 4
    assert len(raw_bytes) == expected_len
    
    arr = np.frombuffer(raw_bytes, dtype=np.float32).reshape((rows, cols))
    assert arr.shape == (rows, cols)
    assert not np.isnan(arr).all()
    print(f"[PASS] /api/model/grid/binary passed (Decoded Float32Array [{rows} x {cols}])")

def test_binary_volume():
    response = client.get("/api/model/volume/binary?variable=temperature&time=2026-09-08T12:00:00")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/octet-stream"
    raw_bytes = response.content
    assert len(raw_bytes) > 0
    print(f"[PASS] /api/model/volume/binary passed ({len(raw_bytes)} bytes)")

def test_observations():
    response = client.get("/api/observations")
    assert response.status_code == 200
    obs = response.json()
    assert len(obs) >= 10
    
    first_id = obs[0]["id"]
    detail_res = client.get(f"/api/observations/{first_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert "profiles" in detail
    assert "trajectory" in detail
    assert len(detail["profiles"]) > 0
    print(f"[PASS] /api/observations & detail passed for {first_id}")

def test_gliders():
    response = client.get("/api/observations/gliders")
    assert response.status_code == 200
    gliders = response.json()
    assert len(gliders) >= 2
    
    first_id = gliders[0]["id"]
    glider_res = client.get(f"/api/observations/gliders/{first_id}")
    assert glider_res.status_code == 200
    mission = glider_res.json()
    assert "waypoints" in mission
    assert len(mission["waypoints"]) > 0
    print(f"[PASS] /api/observations/gliders passed for {first_id} ({len(mission['waypoints'])} 3D waypoints)")

def test_comparison_and_insights():
    obs_res = client.get("/api/observations")
    first_id = obs_res.json()[0]["id"]
    
    comp_res = client.get(f"/api/comparison/{first_id}?variable=temperature&depth=100")
    assert comp_res.status_code == 200
    comp = comp_res.json()
    assert "model_value" in comp
    assert "observed_value" in comp
    assert "column_rmse" in comp
    
    insight_res = client.get(f"/api/insights/{first_id}?depth=100")
    assert insight_res.status_code == 200
    ins = insight_res.json()
    assert "message" in ins
    assert "explanation" in ins
    print(f"[PASS] /api/comparison & /api/insights passed (RMSE: {comp['column_rmse']}, Severity: {comp['severity']})")

if __name__ == "__main__":
    print("--- RUNNING BACKEND INTEGRATION TESTS ---")
    test_health()
    test_variables()
    test_metadata()
    test_binary_grid()
    test_binary_volume()
    test_observations()
    test_gliders()
    test_comparison_and_insights()
    print("--- ALL BACKEND INTEGRATION TESTS PASSED SUCCESSFULLY ---")
