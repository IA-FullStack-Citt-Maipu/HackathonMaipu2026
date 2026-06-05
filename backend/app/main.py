from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(_: FastAPI):
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
