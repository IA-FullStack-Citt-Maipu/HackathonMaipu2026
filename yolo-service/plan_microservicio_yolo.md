# Plan de implementación - Microservicio YOLO

## 1. Objetivo del microservicio

El microservicio YOLO tendrá como responsabilidad principal procesar imágenes del estacionamiento, detectar vehículos y determinar si alguno está obstruyendo zonas de flujo, pasillos, salidas o áreas críticas de circulación.

Este servicio será independiente del backend principal. Su función será recibir una imagen, ejecutar la detección con YOLO, aplicar la lógica de zonas y devolver un resultado estructurado en JSON para que el backend principal pueda guardar, analizar o mostrar la información en el frontend.

---

## 2. Rol dentro de la arquitectura

```text
Frontend React
   ↓
Backend principal
   ↓ HTTP
Microservicio YOLO - FastAPI
   ↓
Modelo YOLO
   ↓
Resultado JSON + imagen anotada opcional
   ↓
Backend principal
   ↓
Supabase PostgreSQL
```

El frontend no se comunicará directamente con YOLO.

El backend principal será quien invoque al microservicio YOLO cuando necesite procesar una imagen, captura o frame proveniente de una cámara.

---

## 3. Puerto del microservicio

El microservicio YOLO debe exponerse en un puerto propio.

Puerto recomendado:

```text
8001
```

Ejemplo de URL local:

```text
http://localhost:8001
```

Ejemplo dentro de Docker Compose:

```text
http://yolo-service:8001
```

El backend principal podrá consumirlo mediante una variable de entorno:

```env
YOLO_SERVICE_URL=http://yolo-service:8001
```

---

## 4. Estructura recomendada del microservicio

```text
yolo-service/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── detector.py
│   ├── zone_service.py
│   ├── obstruction_service.py
│   ├── schemas.py
│   ├── utils/
│   │   └── drawing.py
│   ├── models/
│   │   └── yolo11s.pt
│   ├── uploads/
│   │   └── images/
│   ├── results/
│   │   └── images/
│   └── static/
├── scripts/
│   └── test_request.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env
├── .gitignore
└── README.md
```

---

## 5. Responsabilidades del microservicio

El microservicio YOLO debe encargarse de:

- Recibir imágenes de prueba para el MVP.
- Ejecutar inferencia con YOLO.
- Detectar vehículos.
- Filtrar clases relevantes: auto, moto, bus y camión.
- Cargar zonas digitales de flujo.
- Calcular si un vehículo invade una zona crítica.
- Calcular porcentaje aproximado de obstrucción.
- Generar una imagen anotada opcional.
- Responder con JSON al backend principal.

No debe encargarse de:

- Gestionar usuarios.
- Gestionar reservas.
- Guardar reglas de negocio generales.
- Controlar autenticación del sistema completo.
- Manejar directamente la lógica principal del estacionamiento.

Esas responsabilidades pertenecen al backend principal.

---

## 6. Modelo YOLO recomendado

Para el MVP inicial:

```text
YOLO11s.pt
```

Alternativa:

```text
YOLOv8s.pt
```

Para una siguiente etapa más precisa:

```text
YOLO11s-seg.pt
```

La versión de segmentación será más útil cuando se quiera calcular con mayor precisión cuánto invade un vehículo una vía o salida.

---

## 7. Endpoints del microservicio

### 7.1 Health check

```http
GET /health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "service": "yolo-service",
  "model_loaded": true
}
```

Este endpoint servirá para que el backend principal verifique si el microservicio YOLO está activo.

---

### 7.2 Procesar imagen

```http
POST /api/yolo/detect/image
```

Este endpoint recibirá una imagen y devolverá las detecciones realizadas.

Entrada:

```text
multipart/form-data
file: imagen del estacionamiento
```

Flujo interno:

1. Recibe imagen.
2. Guarda temporalmente la imagen en `uploads/images/`.
3. Ejecuta YOLO.
4. Filtra vehículos.
5. Carga zonas de flujo.
6. Calcula obstrucciones.
7. Genera imagen anotada opcional.
8. Devuelve JSON al backend principal.

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
      "bbox": [120, 180, 320, 390],
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
    },
    {
      "zone_name": "salida_principal",
      "zone_type": "exit",
      "status": "free"
    }
  ],
  "result_image": "/static/results/images/parking_001_annotated.jpg"
}
```

---

### 7.3 Obtener modelos disponibles

```http
GET /api/yolo/models
```

Respuesta esperada:

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

Este endpoint es opcional, pero útil para depuración y documentación.

---

## 8. Comunicación con el backend principal

El backend principal debe llamar al microservicio YOLO usando HTTP.

Ejemplo de flujo:

```text
Backend principal recibe o tiene una captura
        ↓
Backend principal envía imagen a YOLO
        ↓
YOLO devuelve detecciones y obstrucciones
        ↓
Backend principal guarda resultado en Supabase
        ↓
Frontend consulta el estado actualizado
```

Ejemplo de consumo desde backend principal:

```python
import requests

YOLO_SERVICE_URL = "http://yolo-service:8001"

with open("frame.jpg", "rb") as image_file:
    response = requests.post(
        f"{YOLO_SERVICE_URL}/api/yolo/detect/image",
        files={"file": image_file}
    )

result = response.json()
```

---

## 9. Zonas digitales de flujo

Para el MVP, las zonas pueden definirse en un archivo JSON local.

Archivo sugerido:

```text
app/static/zones.json
```

Ejemplo:

```json
{
  "zones": [
    {
      "id": 1,
      "name": "pasillo_principal",
      "type": "flow",
      "points": [[100, 200], [700, 200], [700, 350], [100, 350]]
    },
    {
      "id": 2,
      "name": "salida_principal",
      "type": "exit",
      "points": [[720, 100], [900, 100], [900, 400], [720, 400]]
    }
  ]
}
```

Luego, cuando la base de datos esté lista, estas zonas deberán cargarse desde Supabase PostgreSQL.

---

## 10. Lógica de obstrucción

Para el MVP se usará una lógica simple basada en intersección geométrica.

Regla inicial:

```text
Si el bounding box del vehículo intersecta una zona de flujo, salida o vía, se marca como posible obstrucción.
```

Regla recomendada:

```text
Si el vehículo invade más del 20% de una zona crítica, se marca como obstrucción.
```

Estados posibles:

```text
free
partially_blocked
blocked
```

Ejemplo:

```json
{
  "zone_name": "pasillo_principal",
  "status": "blocked",
  "blocking_vehicle_id": 1,
  "obstruction_percentage": 35.4
}
```

---

## 11. Archivos principales

### main.py

Responsable de levantar FastAPI y exponer endpoints.

Debe incluir:

- `/health`
- `/api/yolo/detect/image`
- `/api/yolo/models`

---

### detector.py

Responsable de cargar el modelo YOLO y detectar vehículos.

Debe incluir:

- Carga del modelo.
- Inferencia sobre imagen.
- Filtro por clases vehiculares.
- Conversión de resultados a JSON.

---

### zone_service.py

Responsable de cargar las zonas digitales.

En MVP:

```text
Carga desde JSON local.
```

En versión integrada:

```text
Carga desde Supabase PostgreSQL.
```

---

### obstruction_service.py

Responsable de calcular intersecciones entre vehículos y zonas.

Debe incluir:

- Conversión de bounding box a polígono.
- Comparación con polígonos de zonas.
- Cálculo de porcentaje de obstrucción.
- Clasificación de estado de zona.

---

### drawing.py

Responsable de generar imagen anotada.

Debe dibujar:

- Vehículos detectados.
- Zonas de flujo.
- Zonas bloqueadas.
- Vehículos obstructores.

---

## 12. Variables de entorno

Archivo `.env` sugerido:

```env
APP_NAME=yolo-service
APP_PORT=8001
YOLO_MODEL_PATH=app/models/yolo11s.pt
CONFIDENCE_THRESHOLD=0.35
OBSTRUCTION_THRESHOLD=0.20
SAVE_ANNOTATED_IMAGES=true
ZONES_FILE_PATH=app/static/zones.json
```

---

## 13. Dockerfile

El Dockerfile debe levantar el microservicio en el puerto 8001.

Ejemplo conceptual:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

---

## 14. docker-compose.yml

Ejemplo conceptual:

```yaml
services:
  yolo-service:
    build: .
    container_name: yolo-service
    ports:
      - "8001:8001"
    env_file:
      - .env
    volumes:
      - ./app/uploads:/app/app/uploads
      - ./app/results:/app/app/results
      - ./app/models:/app/app/models
```

Cuando se integre con el backend principal:

```yaml
services:
  backend:
    environment:
      YOLO_SERVICE_URL: http://yolo-service:8001
    depends_on:
      - yolo-service

  yolo-service:
    build: ./yolo-service
    ports:
      - "8001:8001"
```

---

## 15. Prueba manual con curl

```bash
curl -X POST "http://localhost:8001/api/yolo/detect/image" \
  -F "file=@parking_test.jpg"
```

Respuesta esperada:

```text
JSON con vehículos detectados, zonas afectadas y ruta de imagen anotada.
```

---

## 16. MVP esperado

El MVP del microservicio YOLO estará completo cuando permita:

- Levantar FastAPI en puerto 8001.
- Recibir una imagen por endpoint.
- Detectar vehículos con YOLO.
- Filtrar autos, motos, buses y camiones.
- Cargar zonas digitales desde JSON.
- Detectar si un vehículo invade zonas de flujo.
- Calcular porcentaje de obstrucción.
- Generar imagen anotada.
- Devolver JSON al backend principal.

---

## 17. Integración futura con cámara

Después del MVP, el servicio podrá evolucionar para trabajar con cámara fija o cámara IP.

Se agregarán módulos:

```text
camera_service.py
frame_extractor.py
tracking_service.py
```

Flujo futuro:

```text
Cámara domo/IP
   ↓
Captura cada 30 o 60 segundos
   ↓
YOLO procesa frame
   ↓
Se detectan vehículos y obstrucciones
   ↓
Se envía resultado al backend principal
   ↓
Backend guarda en Supabase y notifica al frontend
```

---

## 18. Preparación para IA/Bot futuro

El microservicio YOLO no debe conectarse directamente con Gemini u otro bot IA.

Lo recomendable es que YOLO entregue datos estructurados al backend principal y que el backend principal exponga esos datos al bot.

Ejemplo:

```text
Usuario pregunta al bot:
¿Qué autos están obstruyendo la salida?

Bot consulta al backend principal.
Backend principal consulta eventos guardados.
Bot responde con datos del estacionamiento.
```

---

## 19. Prioridad de desarrollo

Orden recomendado:

1. Crear estructura del microservicio.
2. Configurar FastAPI en puerto 8001.
3. Crear endpoint `/health`.
4. Instalar Ultralytics/YOLO.
5. Probar inferencia local.
6. Crear endpoint `/api/yolo/detect/image`.
7. Filtrar clases vehiculares.
8. Crear `zones.json`.
9. Implementar lógica de intersección.
10. Generar imagen anotada.
11. Devolver JSON final.
12. Probar consumo desde backend principal.
13. Dockerizar servicio.
14. Integrar en Docker Compose.
15. Preparar evolución a cámara/frames.

---

## 20. Resultado final esperado

El microservicio YOLO debe funcionar como una API independiente de visión artificial, capaz de entregar información clara al backend principal sobre:

- Cantidad de vehículos detectados.
- Tipo de vehículos detectados.
- Coordenadas de cada vehículo.
- Zonas de flujo afectadas.
- Nivel de obstrucción.
- Imagen anotada opcional.
- Estado general de circulación del estacionamiento.

