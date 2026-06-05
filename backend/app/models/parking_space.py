from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Identity,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ParkingSpace(Base):
    __tablename__ = "espacios_estacionamiento"
    __table_args__ = (
        CheckConstraint(
            "tipo IN ('normal', 'discapacitado', 'visita', 'carga', 'otro')",
            name="chk_espacio_tipo",
        ),
        CheckConstraint(
            "estado IN ('disponible', 'ocupado', 'reservado', 'bloqueado', 'mantenimiento')",
            name="chk_espacio_estado",
        ),
    )

    id_espacio: Mapped[int] = mapped_column(
        BigInteger,
        Identity(),
        primary_key=True,
    )
    codigo: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    zona: Mapped[str | None] = mapped_column(String(50))
    tipo: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default=text("'normal'"),
    )
    estado: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default=text("'disponible'"),
    )
    es_doble: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("FALSE"),
    )
    activo: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("TRUE"),
    )

    reservas = relationship("Reservation", back_populates="espacio")
    ocupaciones = relationship("Occupancy", back_populates="espacio")
    incidencias = relationship("Incident", back_populates="espacio")
