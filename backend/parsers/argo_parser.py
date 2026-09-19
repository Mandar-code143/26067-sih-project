import json
import os
from typing import Dict, Any, List, Optional
from .base import BaseObservationParser

class ArgoParser(BaseObservationParser):
    """
    Argo Profiling Float Parser.
    Reads and parses Argo observational datasets containing multi-parameter profiles and historical drift trajectories.
    """

    def __init__(self):
        self.observations: List[Dict[str, Any]] = []

    def load(self, source: str) -> bool:
        if not os.path.exists(source):
            return False
        try:
            with open(source, "r") as f:
                self.observations = json.load(f)
            return True
        except Exception as e:
            print(f"[ArgoParser] Error loading observations from {source}: {e}")
            return False

    def get_summaries(self) -> List[Dict[str, Any]]:
        summaries = []
        for obs in self.observations:
            profiles = obs.get("profiles", [])
            max_depth = max([p["depth"] for p in profiles]) if profiles else 0.0
            summaries.append({
                "id": obs["id"],
                "wmo": obs.get("wmo", obs["id"]),
                "type": obs.get("type", "argo_float"),
                "sensor": obs.get("sensor", "Core-Argo CTD"),
                "region": obs.get("region", "Indian Ocean"),
                "latitude": obs["latitude"],
                "longitude": obs["longitude"],
                "timestamp": obs["timestamp"],
                "max_depth": max_depth,
                "profile_levels": len(profiles)
            })
        return summaries

    def get_platform_details(self, platform_id: str) -> Optional[Dict[str, Any]]:
        for obs in self.observations:
            if obs["id"] == platform_id or obs.get("wmo") == platform_id:
                return obs
        return None
