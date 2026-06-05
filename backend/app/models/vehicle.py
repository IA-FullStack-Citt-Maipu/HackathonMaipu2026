from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Identity,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Vehicle(Base):
    __tablename__ = "vehiculos"
    __table_args__ = (
        CheckConstraint(
            "tipo IN ('auto', 'moto', 'camioneta', 'otro')",
            name="chk_vehiculo_tipo",
        ),
    )

    id_vehiculo: Mapped[int] = mapped_column(
        BigInteger,
        Identity(),
        primary_key=True,
    )
    id_usuario: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id_usuario"),
        nullable=False,
    )
    patente: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    marca: Mapped[str | None] = mapped_column(String(50))
    modelo: Mapped[str | None] = mapped_column(String(50))
    color: Mapped[str | None] = mapped_column(String(30))
    tipo: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default=text("'auto'"),
    )
    activo: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("TRUE"),
    )

    usuario = relationship("User", back_populates="vehiculos")
    reservas = relationship("Reservation", back_populates="vehiculo")
    ocupaciones = relationship("Occupancy", back_populates="vehiculo")
    incidencias = relationship("Incident", back_populates="vehiculo")
