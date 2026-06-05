# Backend API

Base FastAPI para SIGE Estacionamientos conectada a PostgreSQL.

## Levantar localmente

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Docker

Desde la raiz del proyecto:

```powershell
docker compose up -d --build
```

Por defecto, el contenedor `backend` usa `backend/.env.docker`, que actualmente apunta a Supabase.

Si necesitas volver a una base local para desarrollo, usa el perfil opcional `local-db` y cambia el `env_file` del backend a una configuracion local basada en `backend/.env.docker.local.example`.

```powershell
docker compose --profile local-db up -d --build
```

Servicios expuestos:

- API: `http://localhost:8000`
- PostgreSQL local opcional: `localhost:5433`

## Configuracion

La configuracion vive en `backend/.env`.

Variables principales:

- `DATABASE_URL`
- `APP_DEBUG`
- `APP_API_V1_PREFIX`

## Header de autorizacion operativa

Los endpoints operativos validan perfil por rol usando el header:

```text
X-Actor-User-Id: <id_usuario>
```

El usuario actor debe existir en la tabla `usuarios`, estar `activo` y tener un rol autorizado.

## Endpoints principales

- `GET /api/v1/health`
- `GET /api/v1/catalogo/roles`
- `POST /api/v1/catalogo/roles`
- `GET /api/v1/catalogo/usuarios`
- `POST /api/v1/catalogo/usuarios`
- `GET /api/v1/catalogo/vehiculos`
- `POST /api/v1/catalogo/vehiculos`
- `GET /api/v1/catalogo/espacios`
- `POST /api/v1/catalogo/espacios`
- `GET /api/v1/operaciones/ocupacion`
- `POST /api/v1/operaciones/ingresos`
- `GET /api/v1/operaciones/ubicacion?patente=ABCD12`
- `POST /api/v1/operaciones/salidas`
- `GET /api/v1/parametros`
- `PUT /api/v1/parametros`

## Flujo sugerido de prueba

1. Crear roles, por ejemplo `guardia` y `jefe de servicios digitales`.
2. Crear usuarios asociados a esos roles.
3. Crear espacios de estacionamiento.
4. Crear vehiculos.
5. Consultar ocupacion con un usuario guardia en `X-Actor-User-Id`.
6. Registrar ingreso.
7. Consultar ubicacion por patente.
8. Registrar salida.

## Parametros funcionales conectados a la logica

- `permitir_ingreso_sin_reserva`
- `ocupacion_refresco_segundos`
- `validar_propiedad_vehiculo`
