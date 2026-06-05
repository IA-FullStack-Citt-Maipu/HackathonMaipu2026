import unicodedata
from dataclasses import dataclass
from typing import Callable

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.role import Role
from app.models.user import User


@dataclass
class ActorContext:
    id_usuario: int
    nombre: str
    rol: str
    rol_normalizado: str


def normalize_role_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_only.strip().lower().replace("-", "_").replace(" ", "_")


def get_actor(
    x_actor_user_id: int | None = Header(default=None, alias="X-Actor-User-Id"),
    db: Session = Depends(get_db),
) -> ActorContext:
    if x_actor_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Debe enviar el header X-Actor-User-Id.",
        )

    user = db.scalar(
        select(User)
        .options(selectinload(User.rol))
        .where(User.id_usuario == x_actor_user_id)
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario actor no encontrado.",
        )
    if user.estado != "activo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario actor no se encuentra activo.",
        )
    if not user.rol:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario actor no tiene rol asignado.",
        )

    return ActorContext(
        id_usuario=user.id_usuario,
        nombre=user.nombre,
        rol=user.rol.nombre,
        rol_normalizado=normalize_role_name(user.rol.nombre),
    )


def require_roles(*allowed_roles: str) -> Callable[[ActorContext], ActorContext]:
    normalized_allowed = {normalize_role_name(role) for role in allowed_roles}

    def dependency(actor: ActorContext = Depends(get_actor)) -> ActorContext:
        if actor.rol_normalizado not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "El perfil del usuario no está autorizado para esta operación."
                ),
            )
        return actor

    return dependency
