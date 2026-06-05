"""Geometry helpers for obstruction analysis."""

from shapely.geometry import Polygon, box

from app.schemas import VehicleDetection, ZoneDefinition, ZoneStatus


def analyze_obstructions(
    vehicles: list[VehicleDetection],
    zones: list[ZoneDefinition],
    threshold: float,
) -> tuple[list[VehicleDetection], list[ZoneStatus], dict[str, Polygon]]:
    """Analyze vehicle intersection against configured flow zones."""
    zone_geometries = {zone.name: Polygon(zone.points) for zone in zones}
    zones_status: list[ZoneStatus] = []

    for vehicle in vehicles:
        vehicle_polygon = box(*vehicle.bbox)
        best_zone_name = None
        best_overlap = 0.0
        for zone in zones:
            zone_polygon = zone_geometries[zone.name]
            if zone_polygon.area == 0:
                continue
            overlap = vehicle_polygon.intersection(zone_polygon).area / zone_polygon.area
            if overlap > best_overlap:
                best_overlap = overlap
                best_zone_name = zone.name

        if best_zone_name:
            vehicle.obstructed_zone = best_zone_name
            vehicle.obstruction_percentage = round(best_overlap * 100, 2)
            vehicle.is_obstructing = best_overlap >= threshold

    for zone in zones:
        max_overlap = 0.0
        for vehicle in vehicles:
            vehicle_polygon = box(*vehicle.bbox)
            zone_polygon = zone_geometries[zone.name]
            if zone_polygon.area == 0:
                continue
            overlap = vehicle_polygon.intersection(zone_polygon).area / zone_polygon.area
            max_overlap = max(max_overlap, overlap)

        if max_overlap >= threshold:
            state = "blocked"
        elif max_overlap > 0:
            state = "partially_blocked"
        else:
            state = "free"

        zones_status.append(
            ZoneStatus(
                zone_name=zone.name,
                zone_type=zone.type,
                status=state,
            )
        )

    return vehicles, zones_status, zone_geometries
