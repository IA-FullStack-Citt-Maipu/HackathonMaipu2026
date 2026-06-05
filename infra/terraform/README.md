# Terraform local para servicios

Este directorio levanta la infraestructura Docker local de los servicios del proyecto usando Terraform:

- `backend`
- `frontend`
- `yolo-service`

No crea ni administra la base de datos. El backend espera una `DATABASE_URL` externa, por ejemplo Supabase.

## Servicios incluidos

- `backend`: FastAPI principal en `http://localhost:8000`
- `frontend`: React/Vite en `http://localhost:5173`
- `yolo-service`: microservicio de vision en `http://localhost:8001`

## Prerrequisitos

- Docker Desktop o Docker Engine corriendo
- Terraform instalado en tu maquina
- una `DATABASE_URL` valida para el backend

Si vas a desplegar `yolo-service` con capacidad de deteccion real, debes dejar el modelo en:

```text
yolo-service/app/models/yolo11s.pt
```

Si el archivo no existe, el contenedor puede iniciar, pero quedara `unhealthy` y el endpoint de deteccion respondera `503`.

## Uso

1. Entra al directorio:

```powershell
cd infra/terraform
```

2. Crea tu archivo de variables:

```powershell
Copy-Item terraform.tfvars.example terraform.tfvars
```

3. Edita `terraform.tfvars` y completa:

```hcl
backend_database_url = "postgresql://usuario:password@host:5432/postgres?sslmode=require"
```

4. Inicializa Terraform:

```powershell
terraform init
```

5. Revisa el plan:

```powershell
terraform plan
```

6. Aplica:

```powershell
terraform apply
```

7. Cuando termines:

```powershell
terraform destroy
```

## Variables principales

- `backend_database_url`: obligatoria
- `enable_yolo_service`: habilita o deshabilita el microservicio YOLO
- `backend_port`: puerto expuesto del backend
- `frontend_port`: puerto expuesto del frontend
- `yolo_port`: puerto expuesto del microservicio YOLO

## Salidas

- `backend_url`
- `frontend_url`
- `yolo_service_url`
- `container_names`

## Notas de implementacion

- Terraform crea una red Docker dedicada para que `frontend`, `backend` y `yolo-service` se vean por nombre.
- `frontend` usa `VITE_BACKEND_PROXY_TARGET=http://backend:8000`.
- `frontend` usa un volumen dedicado para `/app/node_modules`.
- `backend` y `frontend` montan el codigo del repo para mantener un flujo de desarrollo local.
- `yolo-service` monta `app/uploads`, `app/results` y `app/models` desde el repo.
