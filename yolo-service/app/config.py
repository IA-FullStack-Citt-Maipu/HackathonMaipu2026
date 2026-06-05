"""Application settings for the YOLO microservice."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="yolo-service", alias="APP_NAME")
    app_port: int = Field(default=8001, alias="APP_PORT")
    yolo_model_path: str = Field(default="app/models/yolo11s.pt", alias="YOLO_MODEL_PATH")
    confidence_threshold: float = Field(default=0.35, alias="CONFIDENCE_THRESHOLD")
    yolo_image_size: int = Field(default=1024, alias="YOLO_IMAGE_SIZE")
    obstruction_threshold: float = Field(default=0.20, alias="OBSTRUCTION_THRESHOLD")
    save_annotated_images: bool = Field(default=True, alias="SAVE_ANNOTATED_IMAGES")
    zones_file_path: str = Field(default="app/static/zones.json", alias="ZONES_FILE_PATH")
    uploads_dir_path: str = Field(default="app/uploads", alias="UPLOADS_DIR")
    results_dir_path: str = Field(default="app/results", alias="RESULTS_DIR")
    enable_topdown_class_aliases: bool = Field(default=True, alias="ENABLE_TOPDOWN_CLASS_ALIASES")

    available_models: list[str] = ["yolo11s.pt", "yolo11s-seg.pt", "yolov8s.pt"]

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parents[1]

    def _resolve_path(self, value: str) -> Path:
        path = Path(value)
        if path.is_absolute():
            return path
        return self.project_root / path

    @property
    def model_path(self) -> Path:
        return self._resolve_path(self.yolo_model_path)

    @property
    def zones_path(self) -> Path:
        return self._resolve_path(self.zones_file_path)

    @property
    def uploads_dir(self) -> Path:
        return self._resolve_path(self.uploads_dir_path)

    @property
    def upload_images_dir(self) -> Path:
        return self.uploads_dir / "images"

    @property
    def results_dir(self) -> Path:
        return self._resolve_path(self.results_dir_path)

    @property
    def result_images_dir(self) -> Path:
        return self.results_dir / "images"

    def ensure_runtime_directories(self) -> None:
        for directory in (
            self.model_path.parent,
            self.zones_path.parent,
            self.uploads_dir,
            self.upload_images_dir,
            self.results_dir,
            self.result_images_dir,
        ):
            directory.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings."""
    return Settings()
