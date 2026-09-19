import json
import os
from typing import Dict, Any, List, Optional
from .base import BaseObservationParser

class GliderParser(BaseObservationParser):
    """
    Underwater Autonomous Glider Parser.
    Reads and parses 3D sawtooth diving profiles, missions, and transects.
    """

    def __init__(self):
        self.gliders: List[Dict[str, Any]] = []

    def load(self, source: str) -> bool:
        if not os.path.exists(source):
            return False
        try:
            with open(source, "r") as f:
                self.gliders = json.load(f)
            return True
        except Exception as e:
            print(f"[GliderParser] Error loading gliders from {source}: {e}")
            return False

    def get_summaries(self) -> List[Dict[str, Any]]:
        summaries = []
        for g in self.gliders:
            waypoints = g.get("waypoints", [])
            max_depth = max([w["depth"] for w in waypoints]) if waypoints else 0.0
            summaries.append({
                "id": g["id"],
                "mission_name": g.get("mission_name", "Glider Mission"),
                "platform_type": g.get("platform_type", "Underwater Glider"),
                "region": g.get("region", "Ocean Transect"),
                "status": g.get("status", "Active"),
                "total_waypoints": len(waypoints),
                "max_depth": max_depth,
                "current_position": {
                    "latitude": waypoints[-1]["latitude"] if waypoints else g.get("start_point", {}).get("latitude", 0),
                    "longitude": waypoints[-1]["longitude"] if waypoints else g.get("start_point", {}).get("longitude", 0)
                }
            })
        return summaries

    def get_platform_details(self, platform_id: str) -> Optional[Dict[str, Any]]:
        for g in self.gliders:
            if g["id"] == platform_id:
                return g
        return None
