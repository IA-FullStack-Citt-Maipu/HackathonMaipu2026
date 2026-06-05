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


class Reservation(Base):
    __tablename__ = "reservas"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('pendiente', 'confirmada', 'cancelada', 'finalizada')",
            name="chk_reserva_estado",
        ),
        CheckConstraint(
            "fecha_fin > fecha_inicio",
            name="chk_reserva_fechas",
        ),
    )

    id_reserva: Mapped[int] = mapped_column(
        BigInteger,
        Identity(),
        primary_key=True,
    )
    id_usuario: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id_usuario"),
        nullable=False,
    )
    id_vehiculo: Mapped[int] = mapped_column(
        ForeignKey("vehiculos.id_vehiculo"),
        nullable=False,
    )
    id_espacio: Mapped[int] = mapped_column(
        ForeignKey("espacios_estacionamiento.id_espacio"),
        nullable=False,
    )
    fecha_inicio: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    fecha_fin: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    estado: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default=text("'pendiente'"),
    )
    observacion: Mapped[str | None] = mapped_column(Text)
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    usuario = relationship("User", back_populates="reservas")
    vehiculo = relationship("Vehicle", back_populates="reservas")
    espacio = relationship("ParkingSpace", back_populates="reservas")
    ocupaciones = relationship("Occupancy", back_populates="reserva")
