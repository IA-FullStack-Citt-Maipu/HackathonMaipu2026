from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.base import Base

engine = create_engine(
    settings.sqlalchemy_database_uri,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    class_=Session,
)


def init_db() -> None:
    try:
        Base.metadata.create_all(bind=engine)
    except OperationalError as exc:
        message = (
            "No fue posible conectar a la base de datos configurada en DATABASE_URL. "
            "Verifica credenciales, disponibilidad de red y resolución DNS."
        )
        if "supabase.co" in settings.sqlalchemy_database_uri:
            message += (
                " Si estás usando la conexión directa de Supabase "
                "(db.<project-ref>.supabase.co), considera que suele requerir IPv6. "
                "En una red IPv4 debes usar el session pooler o habilitar IPv4 en Supabase."
            )
        raise RuntimeError(message) from exc


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
