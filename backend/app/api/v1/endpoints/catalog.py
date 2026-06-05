from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.catalog import (
    ParkingSpaceCreate,
    ParkingSpaceRead,
    RoleCreate,
    RoleRead,
    UserCreate,
    UserRead,
    VehicleCreate,
    VehicleRead,
)
from app.services.parking_service import (
    create_parking_space,
    create_role,
    create_user,
    create_vehicle,
    list_roles,
    list_spaces,
    list_users,
    list_vehicles,
)

router = APIRouter(prefix="/catalogo")


@router.get("/roles", response_model=list[RoleRead], summary="Listar roles")
def get_roles(db: Session = Depends(get_db)) -> list[RoleRead]:
    return list_roles(db)


@router.post(
    "/roles",
    response_model=RoleRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear rol",
)
def post_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
) -> RoleRead:
    return create_role(db, payload)


@router.get("/usuarios", response_model=list[UserRead], summary="Listar usuarios")
def get_users(db: Session = Depends(get_db)) -> list[UserRead]:
    return list_users(db)


@router.post(
    "/usuarios",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear usuario",
)
def post_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
) -> UserRead:
    return create_user(db, payload)


@router.get(
    "/vehiculos",
    response_model=list[VehicleRead],
    summary="Listar vehículos",
)
def get_vehicles(db: Session = Depends(get_db)) -> list[VehicleRead]:
    return list_vehicles(db)


@router.post(
    "/vehiculos",
    response_model=VehicleRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear vehículo",
)
def post_vehicle(
    payload: VehicleCreate,
    db: Session = Depends(get_db),
) -> VehicleRead:
    return create_vehicle(db, payload)


@router.get(
    "/espacios",
    response_model=list[ParkingSpaceRead],
    summary="Listar espacios",
)
def get_spaces(db: Session = Depends(get_db)) -> list[ParkingSpaceRead]:
    return list_spaces(db)


@router.post(
    "/espacios",
    response_model=ParkingSpaceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear espacio de estacionamiento",
)
def post_space(
    payload: ParkingSpaceCreate,
    db: Session = Depends(get_db),
) -> ParkingSpaceRead:
    return create_parking_space(db, payload)
