export interface ApiHealth {
  status: string
  database?: string
  detail?: string | null
}

export interface Role {
  id_rol: number
  nombre: string
  descripcion: string | null
}

export interface User {
  id_usuario: number
  id_rol: number
  nombre: string
  correo: string
  telefono: string | null
  estado: 'activo' | 'inactivo' | 'bloqueado'
  fecha_creacion: string
}

export interface Vehicle {
  id_vehiculo: number
  id_usuario: number
  patente: string
  marca: string | null
  modelo: string | null
  color: string | null
  tipo: 'auto' | 'moto' | 'camioneta' | 'otro'
  activo: boolean
}

export interface ParkingSpace {
  id_espacio: number
  codigo: string
  zona: string | null
  tipo: 'normal' | 'discapacitado' | 'visita' | 'carga' | 'otro'
  estado: 'disponible' | 'ocupado' | 'reservado' | 'bloqueado' | 'mantenimiento'
  es_doble: boolean
  activo: boolean
}

export interface Occupancy {
  id_ocupacion: number
  id_usuario: number
  id_vehiculo: number
  id_espacio: number
  fecha_ingreso: string
  fecha_salida: string | null
  estado: string
  observacion: string | null
}

export interface OccupancyCurrentItem {
  id_ocupacion: number
  id_usuario: number
  usuario_nombre: string
  id_vehiculo: number
  patente: string
  id_espacio: number
  codigo_espacio: string
  zona: string | null
  fecha_ingreso: string
  estado: string
}

export interface OccupancySummary {
  total_espacios: number
  espacios_disponibles: number
  espacios_ocupados: number
  espacios_reservados: number
  espacios_bloqueados: number
  espacios_mantenimiento: number
  refresh_sugerido_segundos: number | null
  ocupaciones_activas: OccupancyCurrentItem[]
}

export interface VehicleLocation {
  id_ocupacion: number
  patente: string
  codigo_espacio: string
  zona: string | null
  fecha_ingreso: string
  estado: string
}

export interface VehicleExit {
  id_ocupacion: number
  fecha_salida: string
  estado: 'finalizada'
  espacio_liberado: string
}

export interface RolePayload {
  nombre: string
  descripcion: string
}

export interface UserPayload {
  id_rol: number
  nombre: string
  correo: string
  password_hash: string
  telefono: string
  estado: 'activo' | 'inactivo' | 'bloqueado'
}

export interface VehiclePayload {
  id_usuario: number
  patente: string
  marca: string
  modelo: string
  color: string
  tipo: 'auto' | 'moto' | 'camioneta' | 'otro'
  activo: boolean
}

export interface ParkingSpacePayload {
  codigo: string
  zona: string
  tipo: 'normal' | 'discapacitado' | 'visita' | 'carga' | 'otro'
  estado: 'disponible' | 'ocupado' | 'reservado' | 'bloqueado' | 'mantenimiento'
  es_doble: boolean
  activo: boolean
}

export interface VehicleIngressPayload {
  id_usuario: number
  id_vehiculo: number
  id_espacio: number
  id_reserva?: number | null
  observacion?: string
}

export interface VehicleExitPayload {
  id_ocupacion?: number | null
  patente?: string | null
  observacion?: string
}
