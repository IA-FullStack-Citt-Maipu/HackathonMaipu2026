output "docker_network_name" {
  description = "Nombre de la red Docker creada para los servicios."
  value       = docker_network.services.name
}

output "backend_url" {
  description = "URL local del backend principal."
  value       = "http://localhost:${var.backend_port}${var.backend_api_v1_prefix}"
}

output "frontend_url" {
  description = "URL local del frontend."
  value       = "http://localhost:${var.frontend_port}"
}

output "yolo_service_url" {
  description = "URL local del microservicio YOLO."
  value       = var.enable_yolo_service ? "http://localhost:${var.yolo_port}" : null
}

output "container_names" {
  description = "Nombres de los contenedores gestionados por Terraform."
  value = {
    backend  = docker_container.backend.name
    frontend = docker_container.frontend.name
    yolo     = var.enable_yolo_service ? docker_container.yolo_service[0].name : null
  }
}
