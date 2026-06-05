"""Zone loading and validation utilities."""

import json

from app.config import Settings
from app.schemas import ZonesFile


def load_zones(settings: Settings) -> list:
    """Load and validate the configured zones file."""
    if not settings.zones_path.exists():
        raise RuntimeError(f"Zones file not found at {settings.zones_path}")
    with settings.zones_path.open("r", encoding="utf-8") as file:
        payload = json.load(file)
    zones_file = ZonesFile.model_validate(payload)
    return zones_file.zones
