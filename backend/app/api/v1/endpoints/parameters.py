from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import ActorContext, require_roles
from app.db.session import get_db
from app.schemas.operations import SystemParameterRead, SystemParameterUpsert
from app.services.system_parameter_service import list_parameters, upsert_parameter

router = APIRouter(prefix="/parametros")


@router.get(
    "",
    response_model=list[SystemParameterRead],
    summary="Listar parámetros del sistema",
)
def get_system_parameters(
    db: Session = Depends(get_db),
    _: ActorContext = Depends(require_roles("jefe de servicios digitales", "admin")),
) -> list[SystemParameterRead]:
    return list_parameters(db)


@router.put(
    "",
    response_model=SystemParameterRead,
    summary="Crear o actualizar parámetro del sistema",
)
def put_system_parameter(
    payload: SystemParameterUpsert,
    db: Session = Depends(get_db),
    _: ActorContext = Depends(require_roles("jefe de servicios digitales", "admin")),
) -> SystemParameterRead:
    return upsert_parameter(db, payload)
