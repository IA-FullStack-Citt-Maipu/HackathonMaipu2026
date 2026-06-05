from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.occupancy import Occupancy
from app.models.parking_space import ParkingSpace
from app.models.reservation import Reservation
from app.models.role import Role
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.catalog import ParkingSpaceCreate, RoleCreate, UserCreate, VehicleCreate
from app.schemas.operations import (
    OccupancyCurrentItem,
    OccupancySummary,
    VehicleExitCreate,
    VehicleExitRead,
    VehicleIngressCreate,
    VehicleLocationRead,
)
from app.services.system_parameter_service import get_parameter_value


def normalize_patente(patente: str) -> str:
    return patente.strip().upper().replace(" ", "")


def normalize_space_code(codigo: str) -> str:
    return codigo.strip().upper()


def create_role(db: Session, payload: RoleCreate) -> Role:
    existing = db.scalar(select(Role).where(Role.nombre == payload.nombre))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un rol con ese nombre.",
        )

    role = Role(**payload.model_dump())
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def list_roles(db: Session) -> list[Role]:
    return list(db.scalars(select(Role).order_by(Role.nombre)))


def create_user(db: Session, payload: UserCreate) -> User:
    role = db.get(Role, payload.id_rol)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El rol indicado no existe.",
        )

    existing = db.scalar(select(User).where(User.correo == payload.correo))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese correo.",
        )

    user = User(**payload.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_users(db: Session) -> list[User]:
    return list(db.scalars(select(User).order_by(User.nombre)))


def create_vehicle(db: Session, payload: VehicleCreate) -> Vehicle:
    user = db.get(User, payload.id_usuario)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El usuario del vehículo no existe.",
        )

    normalized_patente = normalize_patente(payload.patente)
    existing = db.scalar(select(Vehicle).where(Vehicle.patente == normalized_patente))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un vehículo con esa patente.",
        )

    vehicle = Vehicle(
        **payload.model_dump(exclude={"patente"}),
        patente=normalized_patente,
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


def list_vehicles(db: Session) -> list[Vehicle]:
    return list(db.scalars(select(Vehicle).order_by(Vehicle.patente)))


def create_parking_space(db: Session, payload: ParkingSpaceCreate) -> ParkingSpace:
    normalized_code = normalize_space_code(payload.codigo)
    existing = db.scalar(
        select(ParkingSpace).where(ParkingSpace.codigo == normalized_code)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un espacio con ese código.",
        )

    space = ParkingSpace(
        **payload.model_dump(exclude={"codigo"}),
        codigo=normalized_code,
    )
    db.add(space)
    db.commit()
    db.refresh(space)
    return space


def list_spaces(db: Session) -> list[ParkingSpace]:
    return list(db.scalars(select(ParkingSpace).order_by(ParkingSpace.codigo)))


def get_occupancy_summary(db: Session) -> OccupancySummary:
    total_espacios = db.scalar(
        select(func.count()).select_from(ParkingSpace).where(ParkingSpace.activo.is_(True))
    ) or 0
    espacios_disponibles = db.scalar(
        select(func.count())
        .select_from(ParkingSpace)
        .where(
            ParkingSpace.activo.is_(True),
            ParkingSpace.estado == "disponible",
        )
    ) or 0
    espacios_ocupados = db.scalar(
        select(func.count())
        .select_from(ParkingSpace)
        .where(
            ParkingSpace.activo.is_(True),
            ParkingSpace.estado == "ocupado",
        )
    ) or 0
    espacios_reservados = db.scalar(
        select(func.count())
        .select_from(ParkingSpace)
        .where(
            ParkingSpace.activo.is_(True),
            ParkingSpace.estado == "reservado",
        )
    ) or 0
    espacios_bloqueados = db.scalar(
        select(func.count())
        .select_from(ParkingSpace)
        .where(
            ParkingSpace.activo.is_(True),
            ParkingSpace.estado == "bloqueado",
        )
    ) or 0
    espacios_mantenimiento = db.scalar(
        select(func.count())
        .select_from(ParkingSpace)
        .where(
            ParkingSpace.activo.is_(True),
            ParkingSpace.estado == "mantenimiento",
        )
    ) or 0

    active_rows = db.execute(
        select(
            Occupancy.id_ocupacion,
            Occupancy.id_usuario,
            User.nombre,
            Occupancy.id_vehiculo,
            Vehicle.patente,
            Occupancy.id_espacio,
            ParkingSpace.codigo,
            ParkingSpace.zona,
            Occupancy.fecha_ingreso,
            Occupancy.estado,
        )
        .join(User, User.id_usuario == Occupancy.id_usuario)
        .join(Vehicle, Vehicle.id_vehiculo == Occupancy.id_vehiculo)
        .join(ParkingSpace, ParkingSpace.id_espacio == Occupancy.id_espacio)
        .where(Occupancy.estado == "activa")
        .order_by(Occupancy.fecha_ingreso.desc())
    ).all()

    ocupaciones_activas = [
        OccupancyCurrentItem(
            id_ocupacion=row[0],
            id_usuario=row[1],
            usuario_nombre=row[2],
            id_vehiculo=row[3],
            patente=row[4],
            id_espacio=row[5],
            codigo_espacio=row[6],
            zona=row[7],
            fecha_ingreso=row[8],
            estado=row[9],
        )
        for row in active_rows
    ]

    try:
        refresh_sugerido_segundos = int(refresh_sugerido) if refresh_sugerido else None
    except ValueError:
        refresh_sugerido_segundos = None

    return OccupancySummary(
        total_espacios=total_espacios,
        espacios_disponibles=espacios_disponibles,
        espacios_ocupados=espacios_ocupados,
        espacios_reservados=espacios_reservados,
        espacios_bloqueados=espacios_bloqueados,
        espacios_mantenimiento=espacios_mantenimiento,
        refresh_sugerido_segundos=refresh_sugerido_segundos,
        ocupaciones_activas=ocupaciones_activas,
    )


def register_vehicle_ingress(db: Session, payload: VehicleIngressCreate) -> Occupancy:
    user = db.get(User, payload.id_usuario)
    if not user or user.estado != "activo":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El usuario indicado no existe o no está activo.",
        )

    vehicle = db.get(Vehicle, payload.id_vehiculo)
    if not vehicle or not vehicle.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El vehículo indicado no existe o no está activo.",
        )
    validar_propiedad = (
        get_parameter_value(db, "validar_propiedad_vehiculo", "true") or "true"
    ).lower() == "true"
    if validar_propiedad and vehicle.id_usuario != payload.id_usuario:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El vehículo no pertenece al usuario indicado.",
        )

    space = db.get(ParkingSpace, payload.id_espacio)
    if not space or not space.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El espacio indicado no existe o no está activo.",
        )
    if space.estado != "disponible":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El espacio indicado no se encuentra disponible.",
        )

    active_occupancy = db.scalar(
        select(Occupancy).where(
            Occupancy.estado == "activa",
            or_(
                Occupancy.id_vehiculo == payload.id_vehiculo,
                Occupancy.id_espacio == payload.id_espacio,
            ),
        )
    )
    if active_occupancy:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una ocupación activa para el vehículo o el espacio.",
        )

    reservation = None
    permitir_sin_reserva = (
        get_parameter_value(db, "permitir_ingreso_sin_reserva", "true") or "true"
    ).lower() == "true"
    if not permitir_sin_reserva and payload.id_reserva is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La configuración actual exige una reserva para registrar ingresos.",
        )
    if payload.id_reserva is not None:
        reservation = db.get(Reservation, payload.id_reserva)
        if not reservation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La reserva indicada no existe.",
            )
        if (
            reservation.id_usuario != payload.id_usuario
            or reservation.id_vehiculo != payload.id_vehiculo
            or reservation.id_espacio != payload.id_espacio
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La reserva no coincide con el usuario, vehículo o espacio.",
            )
        if reservation.estado not in {"pendiente", "confirmada"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La reserva no puede utilizarse para registrar un ingreso.",
            )

    occupancy = Occupancy(
        id_reserva=payload.id_reserva,
        id_usuario=payload.id_usuario,
        id_vehiculo=payload.id_vehiculo,
        id_espacio=payload.id_espacio,
        observacion=payload.observacion,
    )
    db.add(occupancy)
    space.estado = "ocupado"
    if reservation and reservation.estado == "pendiente":
        reservation.estado = "confirmada"

    db.commit()
    db.refresh(occupancy)
    return occupancy


def get_vehicle_location(db: Session, patente: str) -> VehicleLocationRead:
    normalized_patente = normalize_patente(patente)
    row = db.execute(
        select(
            Occupancy.id_ocupacion,
            Vehicle.patente,
            ParkingSpace.codigo,
            ParkingSpace.zona,
            Occupancy.fecha_ingreso,
            Occupancy.estado,
        )
        .join(Vehicle, Vehicle.id_vehiculo == Occupancy.id_vehiculo)
        .join(ParkingSpace, ParkingSpace.id_espacio == Occupancy.id_espacio)
        .where(
            Vehicle.patente == normalized_patente,
            Occupancy.estado == "activa",
        )
    ).first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe una ocupación activa para la patente indicada.",
        )

    return VehicleLocationRead(
        id_ocupacion=row[0],
        patente=row[1],
        codigo_espacio=row[2],
        zona=row[3],
        fecha_ingreso=row[4],
        estado=row[5],
    )


def register_vehicle_exit(db: Session, payload: VehicleExitCreate) -> VehicleExitRead:
    if payload.id_ocupacion is None and not payload.patente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe enviar id_ocupacion o patente para registrar la salida.",
        )

    query = (
        select(Occupancy, ParkingSpace.codigo, ParkingSpace)
        .join(ParkingSpace, ParkingSpace.id_espacio == Occupancy.id_espacio)
        .where(Occupancy.estado == "activa")
    )
    if payload.id_ocupacion is not None:
        query = query.where(Occupancy.id_ocupacion == payload.id_ocupacion)
    else:
        normalized_patente = normalize_patente(payload.patente or "")
        query = query.join(Vehicle, Vehicle.id_vehiculo == Occupancy.id_vehiculo).where(
            Vehicle.patente == normalized_patente
        )

    row = db.execute(query).first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe una ocupación activa que coincida con la salida solicitada.",
        )

    occupancy: Occupancy = row[0]
    space_code: str = row[1]
    space: ParkingSpace = row[2]
    occupancy.fecha_salida = datetime.utcnow()
    occupancy.estado = "finalizada"
    occupancy.observacion = payload.observacion or occupancy.observacion
    space.estado = "disponible"

    if occupancy.reserva and occupancy.reserva.estado in {"pendiente", "confirmada"}:
        occupancy.reserva.estado = "finalizada"

    db.commit()
    db.refresh(occupancy)

    return VehicleExitRead(
        id_ocupacion=occupancy.id_ocupacion,
        fecha_salida=occupancy.fecha_salida,
        estado="finalizada",
        espacio_liberado=space_code,
    )
    refresh_sugerido = get_parameter_value(
        db,
        "ocupacion_refresco_segundos",
        "30",
    )
