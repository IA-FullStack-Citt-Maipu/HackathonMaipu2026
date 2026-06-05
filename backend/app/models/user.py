from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "usuarios"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('activo', 'inactivo', 'bloqueado')",
            name="chk_usuario_estado",
        ),
    )

    id_usuario: Mapped[int] = mapped_column(
        BigInteger,
        Identity(),
        primary_key=True,
    )
    id_rol: Mapped[int] = mapped_column(
        ForeignKey("roles.id_rol"),
        nullable=False,
    )
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    correo: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    telefono: Mapped[str | None] = mapped_column(String(30))
    estado: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'activo'"),
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    rol = relationship("Role", back_populates="usuarios")
    vehiculos = relationship("Vehicle", back_populates="usuario")
    reservas = relationship("Reservation", back_populates="usuario")
    ocupaciones = relationship("Occupancy", back_populates="usuario")
    incidencias = relationship("Incident", back_populates="usuario")
    notificaciones = relationship("Notification", back_populates="usuario")
    reportes = relationship("Report", back_populates="usuario")
