variable "docker_network_name" {
  description = "Nombre de la red Docker compartida por los servicios."
  type        = string
  default     = "hackathomaipu-network"
}

variable "backend_container_name" {
  description = "Nombre del contenedor del backend principal."
  type        = string
  default     = "hackathomaipu-backend"
}

variable "backend_image_name" {
  description = "Nombre de la imagen Docker del backend principal."
  type        = string
  default     = "hackathomaipu-backend:terraform"
}

variable "backend_port" {
  description = "Puerto publicado del backend principal."
  type        = number
  default     = 8000
}

variable "backend_internal_port" {
  description = "Puerto interno del contenedor backend."
  type        = number
  default     = 8000
}

variable "backend_app_name" {
  description = "Nombre expuesto por el backend principal."
  type        = string
  default     = "SIGE Estacionamientos API"
}

variable "backend_app_version" {
  description = "Version expuesta por el backend principal."
  type        = string
  default     = "0.1.0"
}

variable "backend_debug" {
  description = "Activa o desactiva el modo debug del backend."
  type        = bool
  default     = true
}

variable "backend_api_v1_prefix" {
  description = "Prefijo base de la API del backend."
  type        = string
  default     = "/api/v1"
}

variable "backend_database_url" {
  description = "Cadena de conexion a la base de datos externa. Terraform no crea la BDD."
  type        = string
  sensitive   = true
}

variable "frontend_container_name" {
  description = "Nombre del contenedor del frontend."
  type        = string
  default     = "hackathomaipu-frontend"
}

variable "frontend_image_name" {
  description = "Nombre de la imagen Docker del frontend."
  type        = string
  default     = "hackathomaipu-frontend:terraform"
}

variable "frontend_port" {
  description = "Puerto publicado del frontend."
  type        = number
  default     = 5173
}

variable "frontend_internal_port" {
  description = "Puerto interno del contenedor frontend."
  type        = number
  default     = 5173
}

variable "frontend_api_base_url" {
  description = "Base URL consumida por el frontend para hablar con el backend."
  type        = string
  default     = "/api/v1"
}

variable "frontend_node_modules_volume_name" {
  description = "Nombre del volumen dedicado a node_modules del frontend."
  type        = string
  default     = "hackathomaipu-frontend-node-modules"
}

variable "enable_yolo_service" {
  description = "Permite crear o no el microservicio YOLO."
  type        = bool
  default     = true
}

variable "yolo_container_name" {
  description = "Nombre del contenedor del microservicio YOLO."
  type        = string
  default     = "yolo-service"
}

variable "yolo_image_name" {
  description = "Nombre de la imagen Docker del microservicio YOLO."
  type        = string
  default     = "hackathomaipu-yolo-service:terraform"
}

variable "yolo_port" {
  description = "Puerto publicado del microservicio YOLO."
  type        = number
  default     = 8001
}

variable "yolo_internal_port" {
  description = "Puerto interno del contenedor YOLO."
  type        = number
  default     = 8001
}

variable "yolo_app_name" {
  description = "Nombre expuesto por el microservicio YOLO."
  type        = string
  default     = "yolo-service"
}

variable "yolo_model_path" {
  description = "Ruta del modelo YOLO dentro del contenedor."
  type        = string
  default     = "app/models/yolo11s.pt"
}

variable "yolo_confidence_threshold" {
  description = "Threshold minimo de confianza para detectar vehiculos."
  type        = number
  default     = 0.10
}

variable "yolo_image_size" {
  description = "Resolucion usada por YOLO durante la inferencia."
  type        = number
  default     = 1024
}

variable "yolo_obstruction_threshold" {
  description = "Porcentaje minimo para considerar una zona obstruida."
  type        = number
  default     = 0.20
}

variable "yolo_save_annotated_images" {
  description = "Define si el microservicio guarda imagenes anotadas."
  type        = bool
  default     = true
}

variable "yolo_zones_file_path" {
  description = "Ruta del archivo de zonas dentro del contenedor YOLO."
  type        = string
  default     = "app/static/zones.json"
}

variable "yolo_uploads_dir" {
  description = "Ruta base de uploads dentro del contenedor YOLO."
  type        = string
  default     = "app/uploads"
}

variable "yolo_results_dir" {
  description = "Ruta base de resultados dentro del contenedor YOLO."
  type        = string
  default     = "app/results"
}

variable "yolo_enable_topdown_class_aliases" {
  description = "Normaliza clases cenitales como cell phone -> car."
  type        = bool
  default     = true
}
