from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
import numpy as np

class BaseOceanDataParser(ABC):
    """Abstract base class for ocean model data parsers."""
    
    @abstractmethod
    def load(self, source: str) -> bool:
        """Load data from file path or remote URL."""
        pass
    
    @abstractmethod
    def get_metadata(self) -> Dict[str, Any]:
        """Extract dataset metadata including dimensions, variables, and bounding box."""
        pass
    
    @abstractmethod
    def get_grid_slice(self, variable: str, depth: float, timestamp: str) -> Optional[Dict[str, Any]]:
        """Extract a 2D spatial grid slice for a given variable, depth level, and timestamp."""
        pass

    @abstractmethod
    def get_volume_cube(self, variable: str, timestamp: str) -> Optional[Dict[str, Any]]:
        """Extract a 3D (depth, lat, lon) array for volumetric WebGL rendering."""
        pass


class BaseObservationParser(ABC):
    """Abstract base class for in-situ instrument observations (Argo, Gliders, Mooring)."""
    
    @abstractmethod
    def load(self, source: str) -> bool:
        """Load observation profiles."""
        pass
        
    @abstractmethod
    def get_summaries(self) -> List[Dict[str, Any]]:
        """Return high-level summary of observation platforms with lat/lon and timestamps."""
        pass
        
    @abstractmethod
    def get_platform_details(self, platform_id: str) -> Optional[Dict[str, Any]]:
        """Return full 3D vertical profile / trajectory for an individual platform."""
        pass
