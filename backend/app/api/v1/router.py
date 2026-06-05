from fastapi import APIRouter

from app.api.v1.endpoints.catalog import router as catalog_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.operations import router as operations_router
from app.api.v1.endpoints.parameters import router as parameters_router

router = APIRouter()
router.include_router(health_router, tags=["health"])
router.include_router(catalog_router, tags=["catalogo"])
router.include_router(operations_router, tags=["operaciones"])
router.include_router(parameters_router, tags=["parametros"])
