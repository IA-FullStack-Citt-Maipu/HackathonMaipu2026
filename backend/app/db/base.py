from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Importa los modelos aquí para que Alembic los detecte en Base.metadata.
from app import models  # noqa: E402,F401
