locals {
  project_root = replace(abspath("${path.module}/../.."), "\\", "/")
  backend_dir  = "${local.project_root}/backend"
  frontend_dir = "${local.project_root}/frontend"
  yolo_dir     = "${local.project_root}/yolo-service"

  backend_env = [
    "APP_NAME=${var.backend_app_name}",
    "APP_VERSION=${var.backend_app_version}",
    "APP_DEBUG=${tostring(var.backend_debug)}",
    "APP_API_V1_PREFIX=${var.backend_api_v1_prefix}",
    "DATABASE_URL=${var.backend_database_url}",
  ]

  frontend_env = [
    "CHOKIDAR_USEPOLLING=true",
    "VITE_API_BASE_URL=${var.frontend_api_base_url}",
    "VITE_BACKEND_PROXY_TARGET=http://backend:${var.backend_internal_port}",
  ]

  yolo_env = [
    "APP_NAME=${var.yolo_app_name}",
    "APP_PORT=${var.yolo_internal_port}",
    "YOLO_MODEL_PATH=${var.yolo_model_path}",
    "CONFIDENCE_THRESHOLD=${var.yolo_confidence_threshold}",
    "YOLO_IMAGE_SIZE=${var.yolo_image_size}",
    "OBSTRUCTION_THRESHOLD=${var.yolo_obstruction_threshold}",
    "SAVE_ANNOTATED_IMAGES=${tostring(var.yolo_save_annotated_images)}",
    "ZONES_FILE_PATH=${var.yolo_zones_file_path}",
    "UPLOADS_DIR=${var.yolo_uploads_dir}",
    "RESULTS_DIR=${var.yolo_results_dir}",
    "ENABLE_TOPDOWN_CLASS_ALIASES=${tostring(var.yolo_enable_topdown_class_aliases)}",
  ]
}

resource "docker_network" "services" {
  name = var.docker_network_name
}

resource "docker_volume" "frontend_node_modules" {
  name = var.frontend_node_modules_volume_name
}

resource "docker_image" "backend" {
  name         = var.backend_image_name
  keep_locally = true

  build {
    context    = local.backend_dir
    dockerfile = "Dockerfile"
  }
}

resource "docker_container" "backend" {
  name     = var.backend_container_name
  image    = docker_image.backend.image_id
  restart  = "unless-stopped"
  must_run = true

  env = local.backend_env
  command = [
    "uvicorn",
    "app.main:app",
    "--host",
    "0.0.0.0",
    "--port",
    tostring(var.backend_internal_port),
    "--reload",
  ]

  ports {
    internal = var.backend_internal_port
    external = var.backend_port
  }

  mounts {
    target = "/app"
    source = local.backend_dir
    type   = "bind"
  }

  networks_advanced {
    name    = docker_network.services.name
    aliases = ["backend"]
  }

  healthcheck {
    test = [
      "CMD",
      "python",
      "-c",
      "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/live', timeout=5)",
    ]
    interval     = "15s"
    timeout      = "5s"
    retries      = 10
    start_period = "20s"
  }
}

resource "docker_image" "frontend" {
  name         = var.frontend_image_name
  keep_locally = true

  build {
    context    = local.frontend_dir
    dockerfile = "Dockerfile"
  }
}

resource "docker_container" "frontend" {
  name     = var.frontend_container_name
  image    = docker_image.frontend.image_id
  restart  = "unless-stopped"
  must_run = true

  depends_on = [docker_container.backend]
  env        = local.frontend_env

  ports {
    internal = var.frontend_internal_port
    external = var.frontend_port
  }

  mounts {
    target = "/app"
    source = local.frontend_dir
    type   = "bind"
  }

  mounts {
    target = "/app/node_modules"
    source = docker_volume.frontend_node_modules.name
    type   = "volume"
  }

  networks_advanced {
    name    = docker_network.services.name
    aliases = ["frontend"]
  }

  healthcheck {
    test = [
      "CMD",
      "node",
      "-e",
      "fetch('http://127.0.0.1:5173').then((response) => { if (!response.ok) process.exit(1) })",
    ]
    interval     = "15s"
    timeout      = "5s"
    retries      = 10
    start_period = "25s"
  }
}

resource "docker_image" "yolo_service" {
  count        = var.enable_yolo_service ? 1 : 0
  name         = var.yolo_image_name
  keep_locally = true

  build {
    context    = local.yolo_dir
    dockerfile = "Dockerfile"
  }
}

resource "docker_container" "yolo_service" {
  count    = var.enable_yolo_service ? 1 : 0
  name     = var.yolo_container_name
  image    = docker_image.yolo_service[0].image_id
  restart  = "unless-stopped"
  must_run = true

  env = local.yolo_env

  ports {
    internal = var.yolo_internal_port
    external = var.yolo_port
  }

  mounts {
    target = "/app/app/uploads"
    source = "${local.yolo_dir}/app/uploads"
    type   = "bind"
  }

  mounts {
    target = "/app/app/results"
    source = "${local.yolo_dir}/app/results"
    type   = "bind"
  }

  mounts {
    target = "/app/app/models"
    source = "${local.yolo_dir}/app/models"
    type   = "bind"
  }

  networks_advanced {
    name    = docker_network.services.name
    aliases = ["yolo-service", "yolo"]
  }

  healthcheck {
    test = [
      "CMD",
      "python",
      "-c",
      "import json, urllib.request, sys; data = json.load(urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=5)); sys.exit(0 if data.get('status') == 'ok' and data.get('model_loaded') else 1)",
    ]
    interval     = "20s"
    timeout      = "5s"
    retries      = 5
    start_period = "30s"
  }
}
