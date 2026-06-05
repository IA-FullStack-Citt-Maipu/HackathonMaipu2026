from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import ActorContext, require_roles
from app.db.session import get_db
from app.schemas.operations import (
    OccupancyRead,
    OccupancySummary,
    VehicleExitCreate,
    VehicleExitRead,
    VehicleIngressCreate,
    VehicleLocationRead,
)
from app.services.parking_service import (
    get_occupancy_summary,
    get_vehicle_location,
    register_vehicle_exit,
    register_vehicle_ingress,
)

router = APIRouter(prefix="/operaciones")


@router.get(
    "/ocupacion",
    response_model=OccupancySummary,
    summary="Monitorear ocupación actual",
)
def monitor_occupancy(
    db: Session = Depends(get_db),
    _: ActorContext = Depends(
        require_roles("guardia", "jefe de servicios digitales", "admin")
    ),
) -> OccupancySummary:
    return get_occupancy_summary(db)


@router.post(
    "/ingresos",
    response_model=OccupancyRead,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar ingreso de vehículo",
)
def post_vehicle_ingress(
    payload: VehicleIngressCreate,
    db: Session = Depends(get_db),
    _: ActorContext = Depends(require_roles("guardia", "admin")),
) -> OccupancyRead:
    return register_vehicle_ingress(db, payload)


@router.get(
    "/ubicacion",
    response_model=VehicleLocationRead,
    summary="Consultar ubicación actual de un vehículo",
)
def get_location(
    patente: str = Query(..., min_length=4, max_length=20),
    db: Session = Depends(get_db),
    _: ActorContext = Depends(require_roles("guardia", "admin")),
) -> VehicleLocationRead:
    return get_vehicle_location(db, patente)


@router.post(
    "/salidas",
    response_model=VehicleExitRead,
    summary="Registrar salida de vehículo",
)
def post_vehicle_exit(
    payload: VehicleExitCreate,
    db: Session = Depends(get_db),
    _: ActorContext = Depends(require_roles("guardia", "admin")),
) -> VehicleExitRead:
    return register_vehicle_exit(db, payload)
