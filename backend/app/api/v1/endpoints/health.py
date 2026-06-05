from fastapi import APIRouter, Depends, Request
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter()


@router.get("/live", summary="Liveness check")
def live_check() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health", summary="Health check")
def health_check(
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, str | None]:
    startup_error = getattr(request.app.state, "db_startup_error", None)
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected", "detail": startup_error}
    except SQLAlchemyError as exc:
        return {
            "status": "degraded",
            "database": "disconnected",
            "detail": startup_error or str(exc),
        }
