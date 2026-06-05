"""YOLO detector service for image inference."""

from pathlib import Path

import cv2
from ultralytics import YOLO

from app.schemas import VehicleDetection

VEHICLE_CLASSES = {"car", "motorcycle", "bus", "truck"}
TOPDOWN_CLASS_ALIASES = {
    "cell phone": "car",
}


class YoloDetector:
    """Load a YOLO model once and provide normalized detections."""

    def __init__(
        self,
        model_path: Path,
        confidence_threshold: float,
        image_size: int,
        enable_topdown_class_aliases: bool,
    ) -> None:
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        self.image_size = image_size
        self.enable_topdown_class_aliases = enable_topdown_class_aliases
        self.model: YOLO | None = None
        self.load_error: str | None = None
        self._load_model()

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def _load_model(self) -> None:
        if not self.model_path.exists():
            self.load_error = f"Model file not found at {self.model_path}"
            return
        try:
            self.model = YOLO(str(self.model_path))
        except Exception as exc:  # pragma: no cover - defensive path
            self.load_error = str(exc)
            self.model = None

    def detect(self, image_path: Path) -> list[VehicleDetection]:
        if not self.model:
            raise RuntimeError(f"Model is not available: {self.load_error or 'unknown error'}")

        image = cv2.imread(str(image_path))
        if image is None:
            raise ValueError("The uploaded file is not a valid image.")

        results = self.model.predict(
            source=image,
            conf=self.confidence_threshold,
            imgsz=self.image_size,
            verbose=False,
        )
        result = results[0]
        detections: list[VehicleDetection] = []
        vehicle_index = 1
        for box in result.boxes:
            class_id = int(box.cls[0].item())
            raw_class_name = result.names[class_id]
            class_name = raw_class_name
            if self.enable_topdown_class_aliases and raw_class_name in TOPDOWN_CLASS_ALIASES:
                class_name = TOPDOWN_CLASS_ALIASES[raw_class_name]
            if class_name not in VEHICLE_CLASSES:
                continue
            x1, y1, x2, y2 = [round(float(value), 2) for value in box.xyxy[0].tolist()]
            detections.append(
                VehicleDetection(
                    id=vehicle_index,
                    class_name=class_name,
                    confidence=round(float(box.conf[0].item()), 4),
                    bbox=[x1, y1, x2, y2],
                )
            )
            vehicle_index += 1
        return detections
