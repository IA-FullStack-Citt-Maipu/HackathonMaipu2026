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


class ExitRequest(Base):
    __tablename__ = "solicitudes_salida"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('solicitada', 'en_espera', 'autorizada', 'finalizada', 'cancelada')",
            name="chk_solicitud_estado",
        ),
    )

    id_solicitud_salida: Mapped[int] = mapped_column(
        BigInteger,
        Identity(),
        primary_key=True,
    )
    id_ocupacion: Mapped[int] = mapped_column(
        ForeignKey("ocupaciones.id_ocupacion"),
        nullable=False,
    )
    id_usuario: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id_usuario"),
        nullable=False,
    )
    estado: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default=text("'solicitada'"),
    )
    fecha_solicitud: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    fecha_autorizacion: Mapped[datetime | None] = mapped_column(DateTime)
    fecha_finalizacion: Mapped[datetime | None] = mapped_column(DateTime)
    observacion: Mapped[str | None] = mapped_column(Text)

    ocupacion = relationship("Occupancy", back_populates="solicitudes_salida")
