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


class Occupancy(Base):
    __tablename__ = "ocupaciones"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('activa', 'finalizada', 'cancelada')",
            name="chk_ocupacion_estado",
        ),
        CheckConstraint(
            "fecha_salida IS NULL OR fecha_salida >= fecha_ingreso",
            name="chk_ocupacion_fechas",
        ),
    )

    id_ocupacion: Mapped[int] = mapped_column(
        BigInteger,
        Identity(),
        primary_key=True,
    )
    id_reserva: Mapped[int | None] = mapped_column(ForeignKey("reservas.id_reserva"))
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
    fecha_ingreso: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    fecha_salida: Mapped[datetime | None] = mapped_column(DateTime)
    estado: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default=text("'activa'"),
    )
    observacion: Mapped[str | None] = mapped_column(Text)

    reserva = relationship("Reservation", back_populates="ocupaciones")
    usuario = relationship("User", back_populates="ocupaciones")
    vehiculo = relationship("Vehicle", back_populates="ocupaciones")
    espacio = relationship("ParkingSpace", back_populates="ocupaciones")
    bloqueos_como_bloqueante = relationship(
        "VehicleBlock",
        foreign_keys="VehicleBlock.id_ocupacion_bloqueante",
        back_populates="ocupacion_bloqueante",
    )
    bloqueos_como_bloqueada = relationship(
        "VehicleBlock",
        foreign_keys="VehicleBlock.id_ocupacion_bloqueada",
        back_populates="ocupacion_bloqueada",
    )
    solicitudes_salida = relationship("ExitRequest", back_populates="ocupacion")
