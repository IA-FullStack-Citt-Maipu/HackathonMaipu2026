from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class VehicleBlock(Base):
    __tablename__ = "bloqueos_vehiculares"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('activo', 'liberado', 'cancelado')",
            name="chk_bloqueo_estado",
        ),
        CheckConstraint(
            "id_ocupacion_bloqueante <> id_ocupacion_bloqueada",
            name="chk_bloqueo_no_mismo_auto",
        ),
        Index(
            "uq_bloqueo_activo",
            "id_ocupacion_bloqueante",
            "id_ocupacion_bloqueada",
            unique=True,
            postgresql_where=text("estado = 'activo'"),
        ),
    )

    id_bloqueo: Mapped[int] = mapped_column(
        BigInteger,
        Identity(),
        primary_key=True,
    )
    id_ocupacion_bloqueante: Mapped[int] = mapped_column(
        ForeignKey("ocupaciones.id_ocupacion"),
        nullable=False,
    )
    id_ocupacion_bloqueada: Mapped[int] = mapped_column(
        ForeignKey("ocupaciones.id_ocupacion"),
        nullable=False,
    )
    estado: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default=text("'activo'"),
    )
    fecha_registro: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    fecha_liberacion: Mapped[datetime | None] = mapped_column(DateTime)
    observacion: Mapped[str | None] = mapped_column(Text)

    ocupacion_bloqueante = relationship(
        "Occupancy",
        foreign_keys=[id_ocupacion_bloqueante],
        back_populates="bloqueos_como_bloqueante",
    )
    ocupacion_bloqueada = relationship(
        "Occupancy",
        foreign_keys=[id_ocupacion_bloqueada],
        back_populates="bloqueos_como_bloqueada",
    )
