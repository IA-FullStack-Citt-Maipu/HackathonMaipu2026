from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Identity, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SystemParameter(Base):
    __tablename__ = "parametros_sistema"

    id_parametro: Mapped[int] = mapped_column(
        BigInteger,
        Identity(),
        primary_key=True,
    )
    clave: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    valor: Mapped[str] = mapped_column(Text, nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    fecha_actualizacion: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=datetime.utcnow,
    )
