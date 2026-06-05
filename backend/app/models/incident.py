from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Incident(Base):
    __tablename__ = "incidencias"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('pendiente', 'en_revision', 'resuelta', 'cancelada')",
            name="chk_incidencia_estado",
        ),
        CheckConstraint(
            "prioridad IN ('baja', 'media', 'alta', 'critica')",
            name="chk_incidencia_prioridad",
        ),
    )

    id_incidencia: Mapped[int] = mapped_column(
        BigInteger,
        Identity(),
        primary_key=True,
    )
    id_usuario: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id_usuario"),
        nullable=False,
    )
    id_espacio: Mapped[int | None] = mapped_column(
        ForeignKey("espacios_estacionamiento.id_espacio"),
    )
    id_vehiculo: Mapped[int | None] = mapped_column(ForeignKey("vehiculos.id_vehiculo"))
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    estado: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default=text("'pendiente'"),
    )
    prioridad: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'media'"),
    )
    fecha_registro: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    fecha_cierre: Mapped[datetime | None] = mapped_column(DateTime)

    usuario = relationship("User", back_populates="incidencias")
    espacio = relationship("ParkingSpace", back_populates="incidencias")
    vehiculo = relationship("Vehicle", back_populates="incidencias")
