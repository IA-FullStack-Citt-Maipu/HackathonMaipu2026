import type {
  ApiHealth,
  Occupancy,
  OccupancySummary,
  ParkingSpace,
  ParkingSpacePayload,
  Role,
  RolePayload,
  User,
  UserPayload,
  Vehicle,
  VehicleExit,
  VehicleExitPayload,
  VehicleIngressPayload,
  VehicleLocation,
  VehiclePayload,
} from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

function buildUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  let data: unknown = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    const detail =
      typeof data === 'string'
        ? data
        : (data as { detail?: string; message?: string } | null)?.detail ??
          (data as { detail?: string; message?: string } | null)?.message ??
          `Error HTTP ${response.status}`
    throw new ApiError(response.status, detail)
  }

  return data as T
}

async function request<T>(
  path: string,
  init?: RequestInit,
  actorUserId?: string,
): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')

  if (init?.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (actorUserId) {
    headers.set('X-Actor-User-Id', actorUserId)
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
  })

  return parseResponse<T>(response)
}

export const api = {
  getHealth: () => request<ApiHealth>('/health'),
  getLive: () => request<{ status: string }>('/live'),
  getRoles: () => request<Role[]>('/catalogo/roles'),
  createRole: (payload: RolePayload) =>
    request<Role>('/catalogo/roles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getUsers: () => request<User[]>('/catalogo/usuarios'),
  createUser: (payload: UserPayload) =>
    request<User>('/catalogo/usuarios', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getVehicles: () => request<Vehicle[]>('/catalogo/vehiculos'),
  createVehicle: (payload: VehiclePayload) =>
    request<Vehicle>('/catalogo/vehiculos', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getSpaces: () => request<ParkingSpace[]>('/catalogo/espacios'),
  createSpace: (payload: ParkingSpacePayload) =>
    request<ParkingSpace>('/catalogo/espacios', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getOccupancy: (actorUserId: string) =>
    request<OccupancySummary>('/operaciones/ocupacion', undefined, actorUserId),
  registerIngress: (payload: VehicleIngressPayload, actorUserId: string) =>
    request<Occupancy>(
      '/operaciones/ingresos',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      actorUserId,
    ),
  getLocation: (patente: string, actorUserId: string) =>
    request<VehicleLocation>(
      `/operaciones/ubicacion?patente=${encodeURIComponent(patente)}`,
      undefined,
      actorUserId,
    ),
  registerExit: (payload: VehicleExitPayload, actorUserId: string) =>
    request<VehicleExit>(
      '/operaciones/salidas',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      actorUserId,
    ),
}
