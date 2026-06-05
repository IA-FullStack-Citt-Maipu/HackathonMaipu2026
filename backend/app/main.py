import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import settings
from app.db.session import init_db
from app.services.system_parameter_service import seed_default_parameters

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db_startup_error = None
    try:
        init_db()
        seed_default_parameters()
    except RuntimeError as exc:
        app.state.db_startup_error = str(exc)
        logger.warning("Database startup initialization failed: %s", exc)
    yield


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        lifespan=lifespan,
        openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    )
    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_application()
