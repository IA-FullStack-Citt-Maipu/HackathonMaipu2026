"""Schemas for the YOLO microservice."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

ZoneType = Literal["flow", "exit", "lane", "critical"]
ZoneState = Literal["free", "partially_blocked", "blocked"]


class ZoneDefinition(BaseModel):
    """Digital zone definition used in obstruction checks."""

    id: int
    name: str
    type: ZoneType
    points: list[tuple[float, float]] = Field(min_length=3)


class ZonesFile(BaseModel):
    """Wrapper around a zone collection."""

    zones: list[ZoneDefinition] = Field(min_length=1)


class VehicleDetection(BaseModel):
    """Normalized detection response for a vehicle."""

    id: int
    class_name: str
    confidence: float
    bbox: list[float]
    is_obstructing: bool = False
    obstructed_zone: str | None = None
    obstruction_percentage: float = 0.0

    @field_validator("bbox")
    @classmethod
    def validate_bbox(cls, value: list[float]) -> list[float]:
        if len(value) != 4:
            raise ValueError("bbox must contain [x1, y1, x2, y2]")
        return value


class ZoneStatus(BaseModel):
    """Summary status per zone."""

    zone_name: str
    zone_type: str
    status: ZoneState


class DetectionResponse(BaseModel):
    """Response returned after processing an image."""

    success: bool
    source_image: str
    total_vehicles: int
    total_obstructing: int
    vehicles: list[VehicleDetection]
    zones_status: list[ZoneStatus]
    result_image: str | None = None


class HealthResponse(BaseModel):
    """Health endpoint payload."""

    status: str
    service: str
    model_loaded: bool


class ModelsResponse(BaseModel):
    """Catalog of models supported by the service."""

    current_model: str
    available_models: list[str]
