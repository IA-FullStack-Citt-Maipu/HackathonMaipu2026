from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.system_parameter import SystemParameter
from app.schemas.operations import SystemParameterUpsert

DEFAULT_PARAMETERS = [
    (
        "permitir_ingreso_sin_reserva",
        "true",
        "Permite registrar ingresos sin reserva previa.",
    ),
    (
        "ocupacion_refresco_segundos",
        "30",
        "Intervalo sugerido para refrescar el monitoreo.",
    ),
    (
        "validar_propiedad_vehiculo",
        "true",
        "Exige que el vehículo pertenezca al usuario asociado al ingreso.",
    ),
]


def seed_default_parameters() -> None:
    with SessionLocal() as db:
        existing_keys = set(db.scalars(select(SystemParameter.clave)))
        created = False
        for clave, valor, descripcion in DEFAULT_PARAMETERS:
            if clave in existing_keys:
                continue
            db.add(
                SystemParameter(
                    clave=clave,
                    valor=valor,
                    descripcion=descripcion,
                )
            )
            created = True
        if created:
            db.commit()


def list_parameters(db: Session) -> list[SystemParameter]:
    return list(db.scalars(select(SystemParameter).order_by(SystemParameter.clave)))


def get_parameter_value(
    db: Session,
    clave: str,
    default: str | None = None,
) -> str | None:
    value = db.scalar(
        select(SystemParameter.valor).where(SystemParameter.clave == clave)
    )
    if value is None:
        return default
    return value


def upsert_parameter(
    db: Session,
    payload: SystemParameterUpsert,
) -> SystemParameter:
    parameter = db.scalar(
        select(SystemParameter).where(SystemParameter.clave == payload.clave)
    )
    if parameter:
        parameter.valor = payload.valor
        parameter.descripcion = payload.descripcion
        parameter.fecha_actualizacion = datetime.utcnow()
    else:
        parameter = SystemParameter(**payload.model_dump())
        db.add(parameter)

    db.commit()
    db.refresh(parameter)
    return parameter
