# YOLO Service

Microservicio independiente de vision artificial para procesar imagenes de estacionamiento, detectar vehiculos y reportar obstrucciones en zonas de flujo. El backend principal es quien lo consume por HTTP; el frontend no se conecta directamente a este servicio.

## Arquitectura

```text
Frontend React
   ↓
Backend principal
   ↓ HTTP
YOLO Service (FastAPI, puerto 8001)
   ↓
Modelo YOLO + logica de zonas
   ↓
JSON estructurado + imagen anotada opcional
```

## Endpoints

### `GET /health`

```json
{
  "status": "ok",
  "service": "yolo-service",
  "model_loaded": true
}
```

### `GET /api/yolo/models`

```json
{
  "current_model": "yolo11s.pt",
  "available_models": [
    "yolo11s.pt",
    "yolo11s-seg.pt",
    "yolov8s.pt"
  ]
}
```

### `POST /api/yolo/detect/image`

`multipart/form-data` con campo `file`.

Respuesta esperada:

```json
{
  "success": true,
  "source_image": "parking_001.jpg",
  "total_vehicles": 5,
  "total_obstructing": 1,
  "vehicles": [
    {
      "id": 1,
      "class_name": "car",
      "confidence": 0.92,
      "bbox": [120.0, 180.0, 320.0, 390.0],
      "is_obstructing": true,
      "obstructed_zone": "pasillo_principal",
      "obstruction_percentage": 35.4
    }
  ],
  "zones_status": [
    {
      "zone_name": "pasillo_principal",
      "zone_type": "flow",
      "status": "blocked"
    }
  ],
  "result_image": "/static/results/images/parking_001_annotated.jpg"
}
```

## Variables de entorno

```env
APP_NAME=yolo-service
APP_PORT=8001
YOLO_MODEL_PATH=app/models/yolo11s.pt
CONFIDENCE_THRESHOLD=0.10
YOLO_IMAGE_SIZE=1024
OBSTRUCTION_THRESHOLD=0.20
SAVE_ANNOTATED_IMAGES=true
ZONES_FILE_PATH=app/static/zones.json
UPLOADS_DIR=app/uploads
RESULTS_DIR=app/results
ENABLE_TOPDOWN_CLASS_ALIASES=true
```

## Formato de zonas

El archivo [app/static/zones.json](/C:/Users/lucas/Documents/Proyectos-2026/DuocUC/BootcampIA/app/static/zones.json) usa este formato:

```json
{
  "zones": [
    {
      "id": 1,
      "name": "pasillo_principal",
      "type": "flow",
      "points": [[100, 200], [700, 200], [700, 350], [100, 350]]
    }
  ]
}
```

## Arranque local

```powershell
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
```

## Arranque con Docker

```powershell
docker compose up --build
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
```

## Prueba manual con curl

```bash
curl -X POST "http://localhost:8001/api/yolo/detect/image" \
  -F "file=@parking_test.jpg"
```

## Script de prueba

```powershell
.venv\Scripts\python scripts\test_request.py --image parking_test.jpg
```

## Notas de despliegue

- Esta primera imagen Docker esta pensada para CPU y portabilidad cloud.
- El modelo `yolo11s.pt` debe existir en `app/models/` antes del build; asi queda empaquetado dentro de la imagen.
- Para imagenes cenitales como `istockphoto-1318020783-612x612.jpg`, el servicio usa resolucion de inferencia alta y un alias configurable para normalizar detecciones top-down que YOLO clasifica como `cell phone`.
- La evolucion a GPU debe hacerse como variante posterior con una imagen CUDA dedicada, sin cambiar el contrato HTTP del servicio.
