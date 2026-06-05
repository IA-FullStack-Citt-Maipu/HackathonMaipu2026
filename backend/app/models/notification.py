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


class Notification(Base):
    __tablename__ = "notificaciones"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('pendiente', 'enviada', 'leida', 'fallida')",
            name="chk_notificacion_estado",
        ),
    )

    id_notificacion: Mapped[int] = mapped_column(
        BigInteger,
        Identity(),
        primary_key=True,
    )
    id_usuario: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id_usuario"),
        nullable=False,
    )
    titulo: Mapped[str] = mapped_column(String(100), nullable=False)
    mensaje: Mapped[str] = mapped_column(Text, nullable=False)
    tipo: Mapped[str | None] = mapped_column(String(50))
    estado: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default=text("'pendiente'"),
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    fecha_lectura: Mapped[datetime | None] = mapped_column(DateTime)

    usuario = relationship("User", back_populates="notificaciones")
