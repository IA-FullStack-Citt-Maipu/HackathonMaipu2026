"""FastAPI entrypoint for the YOLO microservice."""

from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.staticfiles import StaticFiles

from app.config import Settings, get_settings
from app.detector import YoloDetector
from app.obstruction_service import analyze_obstructions
from app.schemas import (
    DetectionResponse,
    HealthResponse,
    ModelsResponse,
)
from app.utils.drawing import save_annotated_image
from app.zone_service import load_zones


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize shared services and validate configuration."""
    settings = get_settings()
    settings.ensure_runtime_directories()
    app.state.settings = settings
    app.state.zones = load_zones(settings)
    app.state.detector = YoloDetector(
        model_path=settings.model_path,
        confidence_threshold=settings.confidence_threshold,
        image_size=settings.yolo_image_size,
        enable_topdown_class_aliases=settings.enable_topdown_class_aliases,
    )
    yield


def create_app() -> FastAPI:
    """Build the FastAPI application."""
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.mount("/static/results", StaticFiles(directory=settings.results_dir), name="results")

    @app.get("/health", response_model=HealthResponse, tags=["health"])
    def health() -> HealthResponse:
        service_settings = app.state.settings
        detector: YoloDetector = app.state.detector
        return HealthResponse(
            status="ok",
            service=service_settings.app_name,
            model_loaded=detector.is_loaded,
        )

    @app.get("/api/yolo/models", response_model=ModelsResponse, tags=["models"])
    def get_models() -> ModelsResponse:
        service_settings = app.state.settings
        return ModelsResponse(
            current_model=Path(service_settings.yolo_model_path).name,
            available_models=service_settings.available_models,
        )

    @app.post("/api/yolo/detect/image", response_model=DetectionResponse, tags=["detection"])
    async def detect_image(file: UploadFile = File(...)) -> DetectionResponse:
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A filename is required for uploaded images.",
            )
        if not (file.content_type or "").startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only image uploads are supported.",
            )

        settings = app.state.settings
        detector: YoloDetector = app.state.detector
        if not detector.is_loaded:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"YOLO model could not be loaded: {detector.load_error or 'unknown error'}",
            )

        filename = Path(file.filename).name
        suffix = Path(filename).suffix or ".jpg"
        stored_name = f"{Path(filename).stem}_{uuid4().hex[:8]}{suffix}"
        upload_path = settings.upload_images_dir / stored_name
        contents = await file.read()
        upload_path.write_bytes(contents)

        try:
            vehicles = detector.detect(upload_path)
        except ValueError as exc:
            upload_path.unlink(missing_ok=True)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

        analyzed_vehicles, zones_status, zone_geometries = analyze_obstructions(
            vehicles=vehicles,
            zones=app.state.zones,
            threshold=settings.obstruction_threshold,
        )

        result_image = None
        if settings.save_annotated_images:
            result_name = f"{upload_path.stem}_annotated.jpg"
            result_path = settings.result_images_dir / result_name
            save_annotated_image(
                source_path=upload_path,
                output_path=result_path,
                vehicles=analyzed_vehicles,
                zones=app.state.zones,
                zone_geometries=zone_geometries,
            )
            result_image = f"/static/results/images/{result_name}"

        total_obstructing = sum(1 for vehicle in analyzed_vehicles if vehicle.is_obstructing)
        return DetectionResponse(
            success=True,
            source_image=filename,
            total_vehicles=len(analyzed_vehicles),
            total_obstructing=total_obstructing,
            vehicles=analyzed_vehicles,
            zones_status=zones_status,
            result_image=result_image,
        )

    return app


app = create_app()
