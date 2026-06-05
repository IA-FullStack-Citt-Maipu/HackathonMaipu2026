"""Helpers for generating annotated detection images."""

from pathlib import Path

import cv2
import numpy as np
from shapely.geometry import Polygon

from app.schemas import VehicleDetection, ZoneDefinition

GREEN = (60, 180, 75)
YELLOW = (0, 215, 255)
RED = (50, 50, 220)
WHITE = (255, 255, 255)


def save_annotated_image(
    source_path: Path,
    output_path: Path,
    vehicles: list[VehicleDetection],
    zones: list[ZoneDefinition],
    zone_geometries: dict[str, Polygon],
) -> None:
    """Draw vehicles and zones into an annotated image."""
    image = cv2.imread(str(source_path))
    if image is None:
        raise ValueError(f"Unable to open source image for annotation: {source_path}")

    blocked_zones = {vehicle.obstructed_zone for vehicle in vehicles if vehicle.is_obstructing}

    for zone in zones:
        points = zone_geometries[zone.name].exterior.coords[:-1]
        polygon = cv2.convexHull(np.array(points, dtype="int32").reshape((-1, 1, 2)))
        color = RED if zone.name in blocked_zones else YELLOW
        cv2.polylines(image, [polygon], isClosed=True, color=color, thickness=2)
        label_point = tuple(map(int, zone.points[0]))
        cv2.putText(
            image,
            zone.name,
            label_point,
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            color,
            2,
            cv2.LINE_AA,
        )

    for vehicle in vehicles:
        x1, y1, x2, y2 = map(int, vehicle.bbox)
        color = RED if vehicle.is_obstructing else GREEN
        label = f"{vehicle.class_name} {vehicle.confidence:.2f}"
        if vehicle.is_obstructing and vehicle.obstructed_zone:
            label = f"{label} | {vehicle.obstructed_zone} {vehicle.obstruction_percentage:.1f}%"
        cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
        cv2.putText(
            image,
            label,
            (x1, max(20, y1 - 10)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            WHITE,
            2,
            cv2.LINE_AA,
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output_path), image)
