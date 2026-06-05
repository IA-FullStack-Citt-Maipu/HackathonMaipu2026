import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
} from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { ApiError, api } from './api'
import {
  buildManualParkingMap,
  MANUAL_PARKING_SPOTS,
  normalizeParkingCode,
} from './manualParkingMap'
import type { ManualParkingSpotView, ParkingVisualState } from './manualParkingMap'
import type {
  ApiHealth,
  Occupancy,
  OccupancySummary,
  ParkingSpace,
  ParkingSpacePayload,
  Role,
  User,
  UserPayload,
  Vehicle,
  VehicleExit,
  VehicleIngressPayload,
  VehicleLocation,
  VehiclePayload,
} from './types'

type ViewKey = 'ocupacion' | 'operaciones' | 'catalogo'
type CatalogTab = 'espacios' | 'vehiculos' | 'usuarios' | 'roles'
type MessageTone = 'exito' | 'error' | 'info'

interface MessageState {
  tone: MessageTone
  title: string
  text: string
}

interface UserFormState extends Omit<UserPayload, 'id_rol'> {
  id_rol: string
}

interface VehicleFormState extends Omit<VehiclePayload, 'id_usuario'> {
  id_usuario: string
}

type SpaceFormState = ParkingSpacePayload

interface IngressFormState
  extends Omit<
    VehicleIngressPayload,
    'id_usuario' | 'id_vehiculo' | 'id_espacio'
  > {
  id_usuario: string
  id_vehiculo: string
  id_espacio: string
  observacion: string
}

interface ExitFormState {
  id_ocupacion: string
  patente: string
  observacion: string
}

interface OperationLogItem {
  id: string
  timestamp: string
  type: 'entrada' | 'salida' | 'consulta'
  patente: string
  espacio: string
  estado: string
  detalle: string
}

interface NavItem {
  key: ViewKey
  label: string
  subtitle: string
  icon: string
}

interface CatalogTabItem {
  key: CatalogTab
  label: string
}

const navItems: NavItem[] = [
  {
    key: 'ocupacion',
    label: 'Occupancy',
    subtitle: 'Monitoreo en tiempo real',
    icon: 'dashboard',
  },
  {
    key: 'operaciones',
    label: 'Ingress / Egress',
    subtitle: 'Control de accesos',
    icon: 'swap_vert',
  },
  {
    key: 'catalogo',
    label: 'Catalog',
    subtitle: 'Recursos del sistema',
    icon: 'inventory_2',
  },
]

const catalogTabs: CatalogTabItem[] = [
  { key: 'espacios', label: 'Parking Spaces' },
  { key: 'vehiculos', label: 'Vehicles' },
  { key: 'usuarios', label: 'Users' },
  { key: 'roles', label: 'Roles' },
]

const emptyOccupancy: OccupancySummary = {
  total_espacios: 0,
  espacios_disponibles: 0,
  espacios_ocupados: 0,
  espacios_reservados: 0,
  espacios_bloqueados: 0,
  espacios_mantenimiento: 0,
  refresh_sugerido_segundos: null,
  ocupaciones_activas: [],
}

function getVisualStateLabel(state: ParkingVisualState): string {
  switch (state) {
    case 'disponible':
      return 'Disponible'
    case 'ocupado':
      return 'Ocupado'
    case 'reservado':
      return 'Reservado'
    case 'bloqueado':
      return 'Bloqueado'
    case 'mantenimiento':
      return 'Mantenimiento'
    case 'deshabilitado':
      return 'Deshabilitado'
    default:
      return 'Deshabilitado'
  }
}

function getSpotSourceLabel(spot: ManualParkingSpotView): string {
  if (spot.source === 'bd-exacta') {
    return 'Vinculo exacto con BD'
  }
  if (spot.source === 'bd-asignada') {
    return 'Asignado desde BD'
  }
  return 'Plaza estatica sin asociacion BD'
}

function splitIntoRows(spots: ManualParkingSpotView[]): ManualParkingSpotView[][] {
  const rows: ManualParkingSpotView[][] = []

  for (let index = 0; index < spots.length; index += 11) {
    rows.push(spots.slice(index, index + 11))
  }

  return rows
}

function matchesSpotFilter(spot: ManualParkingSpotView, filter: string): boolean {
  const term = filter.trim().toLowerCase()
  if (!term) {
    return true
  }

  return [
    spot.label,
    spot.actualCode ?? '',
    spot.linkedSpace?.zona ?? '',
    spot.linkedOccupancy?.patente ?? '',
    spot.linkedOccupancy?.usuario_nombre ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .includes(term)
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return 'Sin registro'
  }

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatClock(value?: string | null): string {
  if (!value) {
    return '--:--'
  }

  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatRelativeMinutes(value?: string | null): string {
  if (!value) {
    return 'Sin actividad'
  }

  const deltaMs = Date.now() - new Date(value).getTime()
  const deltaMinutes = Math.max(1, Math.round(deltaMs / 60000))

  if (deltaMinutes < 60) {
    return `${deltaMinutes} min`
  }

  const hours = Math.round(deltaMinutes / 60)
  return `${hours} h`
}

function resolveError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.detail
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Ocurrio un error inesperado.'
}

function createCsvValue(value: string | number | boolean | null | undefined): string {
  const normalized = value == null ? '' : String(value)
  return `"${normalized.replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, rows: Array<Array<string | number | boolean | null | undefined>>): void {
  const csv = rows.map((row) => row.map(createCsvValue).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function getParkingSpotClassName(state: ParkingVisualState): string {
  switch (state) {
    case 'disponible':
      return 'spot-disponible'
    case 'ocupado':
      return 'spot-ocupado'
    case 'reservado':
      return 'spot-reservado'
    case 'bloqueado':
      return 'spot-bloqueado'
    case 'mantenimiento':
      return 'spot-mantenimiento'
    case 'deshabilitado':
      return 'spot-deshabilitado'
    default:
      return 'spot-deshabilitado'
  }
}

function getTableStatusClass(status: string): string {
  switch (status) {
    case 'activa':
    case 'activo':
    case 'disponible':
    case 'confirmada':
    case 'finalizada':
      return 'badge-positive'
    case 'ocupado':
    case 'reservado':
      return 'badge-primary'
    case 'bloqueado':
    case 'mantenimiento':
    case 'cancelada':
    case 'bloqueado_usuario':
      return 'badge-danger'
    default:
      return 'badge-neutral'
  }
}

function App() {
  const [activeView, setActiveView] = useState<ViewKey>('ocupacion')
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('espacios')
  const [catalogModalOpen, setCatalogModalOpen] = useState(false)
  const [message, setMessage] = useState<MessageState | null>(null)

  const [health, setHealth] = useState<ApiHealth | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [spaces, setSpaces] = useState<ParkingSpace[]>([])
  const [occupancy, setOccupancy] = useState<OccupancySummary>(emptyOccupancy)

  const [actorUserId, setActorUserId] = useState('')
  const [globalSearchPlate, setGlobalSearchPlate] = useState('')
  const [occupancyFilter, setOccupancyFilter] = useState('')
  const deferredFilter = useDeferredValue(occupancyFilter)
  const [selectedParkingSpotId, setSelectedParkingSpotId] = useState(
    MANUAL_PARKING_SPOTS[0].id,
  )

  const [roleForm, setRoleForm] = useState({
    nombre: '',
    descripcion: '',
  })
  const [userForm, setUserForm] = useState<UserFormState>({
    id_rol: '',
    nombre: '',
    correo: '',
    password_hash: '',
    telefono: '',
    estado: 'activo',
  })
  const [spaceForm, setSpaceForm] = useState<SpaceFormState>({
    codigo: '',
    zona: '',
    tipo: 'normal',
    estado: 'disponible',
    es_doble: false,
    activo: true,
  })
  const [vehicleForm, setVehicleForm] = useState<VehicleFormState>({
    id_usuario: '',
    patente: '',
    marca: '',
    modelo: '',
    color: '',
    tipo: 'auto',
    activo: true,
  })
  const [ingressForm, setIngressForm] = useState<IngressFormState>({
    id_usuario: '',
    id_vehiculo: '',
    id_espacio: '',
    observacion: '',
  })
  const [locationPatente, setLocationPatente] = useState('')
  const [exitForm, setExitForm] = useState<ExitFormState>({
    id_ocupacion: '',
    patente: '',
    observacion: '',
  })

  const [locationResult, setLocationResult] = useState<VehicleLocation | null>(null)
  const [lastIngress, setLastIngress] = useState<Occupancy | null>(null)
  const [lastExit, setLastExit] = useState<VehicleExit | null>(null)
  const [operationFeed, setOperationFeed] = useState<OperationLogItem[]>([])

  const [loading, setLoading] = useState({
    health: false,
    catalogo: false,
    ocupacion: false,
    envio: false,
  })

  const actor = users.find((user) => String(user.id_usuario) === actorUserId) ?? null
  const actorRole = roles.find((role) => role.id_rol === actor?.id_rol)?.nombre ?? 'Sin rol'

  const manualParkingMap = buildManualParkingMap(spaces, occupancy.ocupaciones_activas)
  const parkingRows = splitIntoRows(manualParkingMap)
  const selectedParkingSpot =
    manualParkingMap.find((spot) => spot.id === selectedParkingSpotId) ??
    manualParkingMap.find((spot) => spot.isEnabled) ??
    manualParkingMap[0]
  const staticParkingSpotCount = manualParkingMap.length
  const linkedParkingSpotCount = manualParkingMap.filter(
    (spot) => spot.linkedSpace !== null,
  ).length
  const disabledParkingSpotCount = staticParkingSpotCount - linkedParkingSpotCount
  const visibleParkingSpotCount = manualParkingMap.filter((spot) =>
    matchesSpotFilter(spot, deferredFilter),
  ).length

  const filteredOccupancies = occupancy.ocupaciones_activas.filter((item) => {
    const term = deferredFilter.trim().toLowerCase()
    if (!term) {
      return true
    }

    return [
      item.patente,
      item.usuario_nombre,
      item.codigo_espacio,
      item.zona ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(term)
  })

  const latestDetection = filteredOccupancies[0] ?? occupancy.ocupaciones_activas[0] ?? null
  const occupancyRate = occupancy.total_espacios
    ? Math.round((occupancy.espacios_ocupados / occupancy.total_espacios) * 100)
    : 0
  const availabilityRate = occupancy.total_espacios
    ? Math.round((occupancy.espacios_disponibles / occupancy.total_espacios) * 100)
    : 0
  const activeVehicleCount = vehicles.filter((vehicle) => vehicle.activo).length
  const activeUserCount = users.filter((user) => user.estado === 'activo').length
  const chargingSpaceCount = spaces.filter((space) => space.tipo === 'carga').length
  const reservedSpaceCount = spaces.filter((space) => space.estado === 'reservado').length

  const zoneUsage = Array.from(
    occupancy.ocupaciones_activas.reduce((map, item) => {
      const key = item.zona ?? 'Sin zona'
      map.set(key, (map.get(key) ?? 0) + 1)
      return map
    }, new Map<string, number>()),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)

  const recentOperations =
    operationFeed.length > 0
      ? operationFeed
      : occupancy.ocupaciones_activas.slice(0, 6).map((item) => ({
          id: `active-${item.id_ocupacion}`,
          timestamp: item.fecha_ingreso,
          type: 'entrada' as const,
          patente: item.patente,
          espacio: item.codigo_espacio,
          estado: item.estado,
          detalle: `Ocupacion activa para ${item.usuario_nombre}`,
        }))

  const activeCatalogLabel =
    catalogTabs.find((tab) => tab.key === catalogTab)?.label ?? 'Catalog'

  const modalTitleByTab: Record<CatalogTab, string> = {
    espacios: 'Registrar nuevo espacio',
    vehiculos: 'Registrar nuevo vehiculo',
    usuarios: 'Registrar nuevo usuario',
    roles: 'Registrar nuevo rol',
  }

  const actionLabelByTab: Record<CatalogTab, string> = {
    espacios: 'Add Space',
    vehiculos: 'Add Vehicle',
    usuarios: 'Add User',
    roles: 'Add Role',
  }

  const pushOperation = (item: OperationLogItem) => {
    setOperationFeed((current) => [item, ...current].slice(0, 12))
  }

  const showMessage = (tone: MessageTone, title: string, text: string) => {
    setMessage({ tone, title, text })
  }

  const refreshHealth = async () => {
    setLoading((prev) => ({ ...prev, health: true }))
    try {
      const response = await api.getHealth()
      setHealth(response)
    } catch (error) {
      setHealth({
        status: 'error',
        detail: resolveError(error),
      })
    } finally {
      setLoading((prev) => ({ ...prev, health: false }))
    }
  }

  const refreshCatalog = async () => {
    setLoading((prev) => ({ ...prev, catalogo: true }))
    try {
      const [rolesResponse, usersResponse, vehiclesResponse, spacesResponse] =
        await Promise.all([
          api.getRoles(),
          api.getUsers(),
          api.getVehicles(),
          api.getSpaces(),
        ])

      setRoles(rolesResponse)
      setUsers(usersResponse)
      setVehicles(vehiclesResponse)
      setSpaces(spacesResponse)

      if (!actorUserId && usersResponse.length > 0) {
        setActorUserId(String(usersResponse[0].id_usuario))
      }
    } catch (error) {
      showMessage('error', 'Catalogo no disponible', resolveError(error))
    } finally {
      setLoading((prev) => ({ ...prev, catalogo: false }))
    }
  }

  const refreshOccupancy = async () => {
    if (!actorUserId) {
      setOccupancy(emptyOccupancy)
      return
    }

    setLoading((prev) => ({ ...prev, ocupacion: true }))
    try {
      const response = await api.getOccupancy(actorUserId)
      setOccupancy(response)
    } catch (error) {
      setOccupancy(emptyOccupancy)
      showMessage('error', 'Sin monitoreo activo', resolveError(error))
    } finally {
      setLoading((prev) => ({ ...prev, ocupacion: false }))
    }
  }

  const refreshOperationalData = useEffectEvent(async () => {
    await refreshHealth()
    if (actorUserId) {
      await refreshOccupancy()
    }
  })

  const loadStartupData = useEffectEvent(() => {
    void refreshHealth()
    void refreshCatalog()
  })

  const loadActorData = useEffectEvent(() => {
    if (!actorUserId) {
      return
    }
    void refreshOccupancy()
  })

  const focusSpotByCode = (codigo: string) => {
    const linkedSpot = manualParkingMap.find(
      (spot) =>
        normalizeParkingCode(spot.actualCode ?? spot.label) ===
        normalizeParkingCode(codigo),
    )

    if (linkedSpot) {
      setSelectedParkingSpotId(linkedSpot.id)
    }
  }

  const performVehicleLocationSearch = async (
    patente: string,
    targetView: ViewKey,
    successTitle: string,
  ) => {
    if (!actorUserId) {
      showMessage(
        'error',
        'Actor requerido',
        'Selecciona un usuario actor para consultar la ubicacion.',
      )
      return
    }

    if (!patente.trim()) {
      showMessage('info', 'Patente requerida', 'Ingresa una patente para buscar.')
      return
    }

    setLoading((prev) => ({ ...prev, envio: true }))
    try {
      const response = await api.getLocation(patente, actorUserId)
      setLocationResult(response)
      setGlobalSearchPlate(response.patente)
      setLocationPatente(response.patente)
      focusSpotByCode(response.codigo_espacio)
      pushOperation({
        id: `query-${response.id_ocupacion}-${response.codigo_espacio}-${response.fecha_ingreso}`,
        timestamp: response.fecha_ingreso,
        type: 'consulta',
        patente: response.patente,
        espacio: response.codigo_espacio,
        estado: response.estado,
        detalle: `Ubicacion encontrada en ${response.zona ?? 'sin zona'}`,
      })
      startTransition(() => {
        setActiveView(targetView)
      })
      showMessage(
        'exito',
        successTitle,
        `Patente ${response.patente} ubicada en ${response.codigo_espacio}.`,
      )
    } catch (error) {
      setLocationResult(null)
      showMessage('error', 'Busqueda fallida', resolveError(error))
    } finally {
      setLoading((prev) => ({ ...prev, envio: false }))
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadStartupData()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadActorData()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [actorUserId])

  useEffect(() => {
    const intervalSeconds = occupancy.refresh_sugerido_segundos ?? 30
    const timer = window.setInterval(() => {
      void refreshOperationalData()
    }, intervalSeconds * 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [occupancy.refresh_sugerido_segundos])

  useEffect(() => {
    if (!message) {
      return
    }

    const timer = window.setTimeout(() => {
      setMessage(null)
    }, 4200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [message])

  useEffect(() => {
    if (!catalogModalOpen) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCatalogModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [catalogModalOpen])

  const handleManualRefresh = () => {
    void refreshHealth()
    void refreshCatalog()
    if (actorUserId) {
      void refreshOccupancy()
    }
  }

  const handleEmergencyOverride = () => {
    showMessage(
      'info',
      'Override manual',
      'No existe endpoint para override todavia. La accion queda solo en modo UI.',
    )
  }

  const handleTopSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await performVehicleLocationSearch(
      globalSearchPlate,
      'ocupacion',
      'Ubicacion localizada',
    )
  }

  const handleLocationSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await performVehicleLocationSearch(
      locationPatente,
      'operaciones',
      'Consulta operativa exitosa',
    )
  }

  const submitRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading((prev) => ({ ...prev, envio: true }))
    try {
      await api.createRole(roleForm)
      setRoleForm({
        nombre: '',
        descripcion: '',
      })
      await refreshCatalog()
      setCatalogModalOpen(false)
      showMessage('exito', 'Rol creado', 'El rol fue registrado correctamente.')
    } catch (error) {
      showMessage('error', 'No se pudo crear el rol', resolveError(error))
    } finally {
      setLoading((prev) => ({ ...prev, envio: false }))
    }
  }

  const submitUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading((prev) => ({ ...prev, envio: true }))
    try {
      await api.createUser({
        ...userForm,
        id_rol: Number(userForm.id_rol),
      })
      setUserForm({
        id_rol: '',
        nombre: '',
        correo: '',
        password_hash: '',
        telefono: '',
        estado: 'activo',
      })
      await refreshCatalog()
      setCatalogModalOpen(false)
      showMessage(
        'exito',
        'Usuario creado',
        'El usuario fue registrado correctamente.',
      )
    } catch (error) {
      showMessage('error', 'No se pudo crear el usuario', resolveError(error))
    } finally {
      setLoading((prev) => ({ ...prev, envio: false }))
    }
  }

  const submitSpace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading((prev) => ({ ...prev, envio: true }))
    try {
      await api.createSpace(spaceForm)
      setSpaceForm({
        codigo: '',
        zona: '',
        tipo: 'normal',
        estado: 'disponible',
        es_doble: false,
        activo: true,
      })
      await refreshCatalog()
      setCatalogModalOpen(false)
      showMessage(
        'exito',
        'Espacio creado',
        'El espacio fue registrado correctamente.',
      )
    } catch (error) {
      showMessage('error', 'No se pudo crear el espacio', resolveError(error))
    } finally {
      setLoading((prev) => ({ ...prev, envio: false }))
    }
  }

  const submitVehicle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading((prev) => ({ ...prev, envio: true }))
    try {
      await api.createVehicle({
        ...vehicleForm,
        id_usuario: Number(vehicleForm.id_usuario),
      })
      setVehicleForm({
        id_usuario: '',
        patente: '',
        marca: '',
        modelo: '',
        color: '',
        tipo: 'auto',
        activo: true,
      })
      await refreshCatalog()
      setCatalogModalOpen(false)
      showMessage(
        'exito',
        'Vehiculo creado',
        'El vehiculo fue registrado correctamente.',
      )
    } catch (error) {
      showMessage('error', 'No se pudo crear el vehiculo', resolveError(error))
    } finally {
      setLoading((prev) => ({ ...prev, envio: false }))
    }
  }

  const submitIngress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!actorUserId) {
      showMessage(
        'error',
        'Actor requerido',
        'Selecciona un usuario actor para registrar el ingreso.',
      )
      return
    }

    setLoading((prev) => ({ ...prev, envio: true }))
    try {
      const response = await api.registerIngress(
        {
          id_usuario: Number(ingressForm.id_usuario),
          id_vehiculo: Number(ingressForm.id_vehiculo),
          id_espacio: Number(ingressForm.id_espacio),
          observacion: ingressForm.observacion || undefined,
        },
        actorUserId,
      )

      const selectedVehicle = vehicles.find(
        (vehicle) => vehicle.id_vehiculo === Number(ingressForm.id_vehiculo),
      )
      const selectedSpace = spaces.find(
        (space) => space.id_espacio === Number(ingressForm.id_espacio),
      )

      setLastIngress(response)
      setLastExit(null)
      setIngressForm({
        id_usuario: '',
        id_vehiculo: '',
        id_espacio: '',
        observacion: '',
      })
      if (selectedVehicle?.patente) {
        setLocationPatente(selectedVehicle.patente)
        setGlobalSearchPlate(selectedVehicle.patente)
      }

      pushOperation({
        id: `entry-${response.id_ocupacion}-${response.fecha_ingreso}`,
        timestamp: response.fecha_ingreso,
        type: 'entrada',
        patente: selectedVehicle?.patente ?? 'Sin patente',
        espacio: selectedSpace?.codigo ?? `#${response.id_espacio}`,
        estado: response.estado,
        detalle: ingressForm.observacion || 'Ingreso manual registrado por guardia.',
      })

      await refreshCatalog()
      await refreshOccupancy()
      showMessage(
        'exito',
        'Ingreso autorizado',
        'Vehiculo registrado y barrera liberada.',
      )
    } catch (error) {
      showMessage('error', 'Ingreso rechazado', resolveError(error))
    } finally {
      setLoading((prev) => ({ ...prev, envio: false }))
    }
  }

  const submitExit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!actorUserId) {
      showMessage(
        'error',
        'Actor requerido',
        'Selecciona un usuario actor para registrar la salida.',
      )
      return
    }

    setLoading((prev) => ({ ...prev, envio: true }))
    try {
      const plateUsed = exitForm.patente || locationResult?.patente || 'Sin patente'
      const response = await api.registerExit(
        {
          id_ocupacion: exitForm.id_ocupacion
            ? Number(exitForm.id_ocupacion)
            : undefined,
          patente: exitForm.patente || undefined,
          observacion: exitForm.observacion || undefined,
        },
        actorUserId,
      )

      setLastExit(response)
      setLastIngress(null)
      setExitForm({
        id_ocupacion: '',
        patente: '',
        observacion: '',
      })

      if (locationResult?.id_ocupacion === response.id_ocupacion) {
        setLocationResult(null)
      }

      pushOperation({
        id: `exit-${response.id_ocupacion}-${response.fecha_salida}`,
        timestamp: response.fecha_salida,
        type: 'salida',
        patente: plateUsed,
        espacio: response.espacio_liberado,
        estado: response.estado,
        detalle: 'Salida autorizada y ocupacion finalizada.',
      })

      await refreshCatalog()
      await refreshOccupancy()
      showMessage(
        'exito',
        'Salida autorizada',
        `Transaccion finalizada para ${plateUsed}.`,
      )
    } catch (error) {
      showMessage('error', 'No se pudo registrar la salida', resolveError(error))
    } finally {
      setLoading((prev) => ({ ...prev, envio: false }))
    }
  }

  const handleExportOccupancy = () => {
    downloadCsv(
      'ocupaciones_activas.csv',
      [
        [
          'Patente',
          'Espacio',
          'Zona',
          'Hora ingreso',
          'Usuario',
          'Estado',
        ],
        ...filteredOccupancies.map((item) => [
          item.patente,
          item.codigo_espacio,
          item.zona ?? '',
          item.fecha_ingreso,
          item.usuario_nombre,
          item.estado,
        ]),
      ],
    )
  }

  const handleExportCatalog = () => {
    if (catalogTab === 'espacios') {
      downloadCsv(
        'catalogo_espacios.csv',
        [
          ['Codigo', 'Zona', 'Tipo', 'Estado', 'Activo'],
          ...spaces.map((space) => [
            space.codigo,
            space.zona ?? '',
            space.tipo,
            space.estado,
            space.activo,
          ]),
        ],
      )
      return
    }

    if (catalogTab === 'vehiculos') {
      downloadCsv(
        'catalogo_vehiculos.csv',
        [
          ['Patente', 'Marca', 'Modelo', 'Color', 'Tipo', 'Usuario', 'Activo'],
          ...vehicles.map((vehicle) => [
            vehicle.patente,
            vehicle.marca ?? '',
            vehicle.modelo ?? '',
            vehicle.color ?? '',
            vehicle.tipo,
            users.find((user) => user.id_usuario === vehicle.id_usuario)?.nombre ?? '',
            vehicle.activo,
          ]),
        ],
      )
      return
    }

    if (catalogTab === 'usuarios') {
      downloadCsv(
        'catalogo_usuarios.csv',
        [
          ['Nombre', 'Correo', 'Rol', 'Estado', 'Telefono'],
          ...users.map((user) => [
            user.nombre,
            user.correo,
            roles.find((role) => role.id_rol === user.id_rol)?.nombre ?? '',
            user.estado,
            user.telefono ?? '',
          ]),
        ],
      )
      return
    }

    downloadCsv(
      'catalogo_roles.csv',
      [
        ['ID', 'Nombre', 'Descripcion'],
        ...roles.map((role) => [role.id_rol, role.nombre, role.descripcion ?? '']),
      ],
    )
  }

  const renderCatalogTable = () => {
    if (catalogTab === 'espacios') {
      return (
        <table className="data-table">
          <thead>
            <tr>
              <th>Space ID</th>
              <th>Section</th>
              <th>Category</th>
              <th>Status</th>
              <th>Occupant</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {spaces.map((space) => {
              const linkedOccupancy = occupancy.ocupaciones_activas.find(
                (item) => item.id_espacio === space.id_espacio,
              )

              return (
                <tr key={space.id_espacio}>
                  <td className="mono-cell">{space.codigo}</td>
                  <td>{space.zona ?? 'Sin zona'}</td>
                  <td>
                    <span className="badge badge-neutral">{space.tipo}</span>
                  </td>
                  <td>
                    <span className={`badge ${getTableStatusClass(space.estado)}`}>
                      {space.estado}
                    </span>
                  </td>
                  <td className="mono-cell">
                    {linkedOccupancy?.patente ?? '--'}
                  </td>
                  <td>{space.activo ? 'Activo' : 'Inactivo'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )
    }

    if (catalogTab === 'vehiculos') {
      return (
        <table className="data-table">
          <thead>
            <tr>
              <th>Patente</th>
              <th>Propietario</th>
              <th>Modelo</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Color</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id_vehiculo}>
                <td className="mono-cell">{vehicle.patente}</td>
                <td>
                  {users.find((user) => user.id_usuario === vehicle.id_usuario)?.nombre ??
                    `Usuario #${vehicle.id_usuario}`}
                </td>
                <td>{[vehicle.marca, vehicle.modelo].filter(Boolean).join(' ') || '--'}</td>
                <td>
                  <span className="badge badge-neutral">{vehicle.tipo}</span>
                </td>
                <td>
                  <span className={`badge ${vehicle.activo ? 'badge-positive' : 'badge-danger'}`}>
                    {vehicle.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>{vehicle.color ?? 'Sin color'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    if (catalogTab === 'usuarios') {
      return (
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Status</th>
              <th>Telefono</th>
              <th>Creacion</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id_usuario}>
                <td>{user.nombre}</td>
                <td>{user.correo}</td>
                <td>
                  <span className="badge badge-neutral">
                    {roles.find((role) => role.id_rol === user.id_rol)?.nombre ?? `Rol #${user.id_rol}`}
                  </span>
                </td>
                <td>
                  <span className={`badge ${getTableStatusClass(user.estado)}`}>
                    {user.estado}
                  </span>
                </td>
                <td>{user.telefono ?? '--'}</td>
                <td>{formatDateTime(user.fecha_creacion)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Descripcion</th>
            <th>Usuarios vinculados</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.id_rol}>
              <td className="mono-cell">#{role.id_rol}</td>
              <td>{role.nombre}</td>
              <td>{role.descripcion ?? 'Sin descripcion'}</td>
              <td>
                {users.filter((user) => user.id_rol === role.id_rol).length}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  const renderCatalogModal = () => {
    if (!catalogModalOpen) {
      return null
    }

    return (
      <div className="modal-backdrop" onClick={() => setCatalogModalOpen(false)}>
        <div
          className="modal-card"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-header">
            <div>
              <p className="section-kicker">System Registry</p>
              <h3>{modalTitleByTab[catalogTab]}</h3>
            </div>
            <button
              className="icon-action"
              onClick={() => setCatalogModalOpen(false)}
              type="button"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {catalogTab === 'roles' ? (
            <form className="modal-form" onSubmit={submitRole}>
              <label>
                <span>Nombre del rol</span>
                <input
                  value={roleForm.nombre}
                  onChange={(event) =>
                    setRoleForm((prev) => ({ ...prev, nombre: event.target.value }))
                  }
                  placeholder="guardia"
                />
              </label>
              <label>
                <span>Descripcion</span>
                <textarea
                  rows={4}
                  value={roleForm.descripcion}
                  onChange={(event) =>
                    setRoleForm((prev) => ({
                      ...prev,
                      descripcion: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="modal-actions">
                <button
                  className="ghost-button"
                  onClick={() => setCatalogModalOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button className="primary-button" type="submit">
                  Guardar rol
                </button>
              </div>
            </form>
          ) : null}

          {catalogTab === 'usuarios' ? (
            <form className="modal-form" onSubmit={submitUser}>
              <div className="modal-grid">
                <label>
                  <span>Rol</span>
                  <select
                    value={userForm.id_rol}
                    onChange={(event) =>
                      setUserForm((prev) => ({ ...prev, id_rol: event.target.value }))
                    }
                  >
                    <option value="">Selecciona un rol</option>
                    {roles.map((role) => (
                      <option key={role.id_rol} value={role.id_rol}>
                        {role.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Estado</span>
                  <select
                    value={userForm.estado}
                    onChange={(event) =>
                      setUserForm((prev) => ({
                        ...prev,
                        estado: event.target.value as User['estado'],
                      }))
                    }
                  >
                    <option value="activo">activo</option>
                    <option value="inactivo">inactivo</option>
                    <option value="bloqueado">bloqueado</option>
                  </select>
                </label>
                <label className="field-span-2">
                  <span>Nombre</span>
                  <input
                    value={userForm.nombre}
                    onChange={(event) =>
                      setUserForm((prev) => ({ ...prev, nombre: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>Correo</span>
                  <input
                    type="email"
                    value={userForm.correo}
                    onChange={(event) =>
                      setUserForm((prev) => ({ ...prev, correo: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>Password hash</span>
                  <input
                    value={userForm.password_hash}
                    onChange={(event) =>
                      setUserForm((prev) => ({
                        ...prev,
                        password_hash: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field-span-2">
                  <span>Telefono</span>
                  <input
                    value={userForm.telefono}
                    onChange={(event) =>
                      setUserForm((prev) => ({ ...prev, telefono: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button
                  className="ghost-button"
                  onClick={() => setCatalogModalOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button className="primary-button" type="submit">
                  Guardar usuario
                </button>
              </div>
            </form>
          ) : null}

          {catalogTab === 'vehiculos' ? (
            <form className="modal-form" onSubmit={submitVehicle}>
              <div className="modal-grid">
                <label className="field-span-2">
                  <span>Usuario asociado</span>
                  <select
                    value={vehicleForm.id_usuario}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        id_usuario: event.target.value,
                      }))
                    }
                  >
                    <option value="">Selecciona un usuario</option>
                    {users.map((user) => (
                      <option key={user.id_usuario} value={user.id_usuario}>
                        {user.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Patente</span>
                  <input
                    value={vehicleForm.patente}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        patente: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="ABC-1234"
                  />
                </label>
                <label>
                  <span>Tipo</span>
                  <select
                    value={vehicleForm.tipo}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        tipo: event.target.value as Vehicle['tipo'],
                      }))
                    }
                  >
                    <option value="auto">auto</option>
                    <option value="moto">moto</option>
                    <option value="camioneta">camioneta</option>
                    <option value="otro">otro</option>
                  </select>
                </label>
                <label>
                  <span>Marca</span>
                  <input
                    value={vehicleForm.marca}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({ ...prev, marca: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>Modelo</span>
                  <input
                    value={vehicleForm.modelo}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({ ...prev, modelo: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>Color</span>
                  <input
                    value={vehicleForm.color}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({ ...prev, color: event.target.value }))
                    }
                  />
                </label>
                <label className="field-span-2 checkbox-field">
                  <input
                    checked={vehicleForm.activo}
                    onChange={(event) =>
                      setVehicleForm((prev) => ({
                        ...prev,
                        activo: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  <span>Vehiculo activo</span>
                </label>
              </div>
              <div className="modal-actions">
                <button
                  className="ghost-button"
                  onClick={() => setCatalogModalOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button className="primary-button" type="submit">
                  Guardar vehiculo
                </button>
              </div>
            </form>
          ) : null}

          {catalogTab === 'espacios' ? (
            <form className="modal-form" onSubmit={submitSpace}>
              <div className="modal-grid">
                <label>
                  <span>Codigo</span>
                  <input
                    value={spaceForm.codigo}
                    onChange={(event) =>
                      setSpaceForm((prev) => ({ ...prev, codigo: event.target.value }))
                    }
                    placeholder="A1-001"
                  />
                </label>
                <label>
                  <span>Zona</span>
                  <input
                    value={spaceForm.zona}
                    onChange={(event) =>
                      setSpaceForm((prev) => ({ ...prev, zona: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>Tipo</span>
                  <select
                    value={spaceForm.tipo}
                    onChange={(event) =>
                      setSpaceForm((prev) => ({
                        ...prev,
                        tipo: event.target.value as ParkingSpace['tipo'],
                      }))
                    }
                  >
                    <option value="normal">normal</option>
                    <option value="discapacitado">discapacitado</option>
                    <option value="visita">visita</option>
                    <option value="carga">carga</option>
                    <option value="otro">otro</option>
                  </select>
                </label>
                <label>
                  <span>Estado</span>
                  <select
                    value={spaceForm.estado}
                    onChange={(event) =>
                      setSpaceForm((prev) => ({
                        ...prev,
                        estado: event.target.value as ParkingSpace['estado'],
                      }))
                    }
                  >
                    <option value="disponible">disponible</option>
                    <option value="ocupado">ocupado</option>
                    <option value="reservado">reservado</option>
                    <option value="bloqueado">bloqueado</option>
                    <option value="mantenimiento">mantenimiento</option>
                  </select>
                </label>
                <label className="checkbox-field">
                  <input
                    checked={spaceForm.es_doble}
                    onChange={(event) =>
                      setSpaceForm((prev) => ({
                        ...prev,
                        es_doble: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  <span>Espacio doble</span>
                </label>
                <label className="checkbox-field">
                  <input
                    checked={spaceForm.activo}
                    onChange={(event) =>
                      setSpaceForm((prev) => ({
                        ...prev,
                        activo: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  <span>Activo</span>
                </label>
              </div>
              <div className="modal-actions">
                <button
                  className="ghost-button"
                  onClick={() => setCatalogModalOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button className="primary-button" type="submit">
                  Guardar espacio
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    )
  }

  const renderOccupancyView = () => (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <p className="section-kicker">Occupancy Monitoring</p>
          <h1>Monitoreo de ocupacion</h1>
          <p className="page-copy">
            Metricas en vivo, mapa operativo y sesiones activas del terminal.
          </p>
        </div>
        <div className="live-chip">
          <span className="live-dot"></span>
          <span>SYSTEM LIVE FEED</span>
        </div>
      </div>

      <section className="hero-grid">
        <article className="hero-main-card">
          <div className="hero-main-copy">
            <p>Mapa fisico</p>
            <strong>{staticParkingSpotCount}</strong>
            <span>110 plazas fijas dibujadas en el frontend</span>
          </div>
          <div className="hero-main-mark">P</div>
        </article>

        <MetricCard
          label="Habilitadas BD"
          value={String(linkedParkingSpotCount)}
          tone="primary"
          progress={Math.round((linkedParkingSpotCount / staticParkingSpotCount) * 100)}
        />
        <MetricCard
          label="Deshabilitadas"
          value={String(disabledParkingSpotCount)}
          tone="neutral"
          progress={Math.round((disabledParkingSpotCount / staticParkingSpotCount) * 100)}
        />
        <MetricCard
          label="Disponibles BD"
          value={String(occupancy.espacios_disponibles)}
          tone="success"
          progress={availabilityRate}
        />
        <MetricCard
          label="Ocupadas BD"
          value={String(occupancy.espacios_ocupados)}
          tone="warning"
          progress={occupancyRate}
        />
        <MetricCard
          label="Bloq / Mant BD"
          value={String(occupancy.espacios_mantenimiento + occupancy.espacios_bloqueados)}
          tone="danger"
          progress={occupancy.total_espacios ? Math.round(((occupancy.espacios_mantenimiento + occupancy.espacios_bloqueados) / occupancy.total_espacios) * 100) : 0}
        />
      </section>

      <div className="dashboard-grid">
        <section className="surface-card surface-card-wide">
          <div className="card-header">
            <div>
              <p className="section-kicker">Activas</p>
              <h2>Ocupaciones activas</h2>
            </div>
            <div className="card-actions">
              <input
                className="ghost-input"
                placeholder="Filtrar por patente, usuario o espacio"
                value={occupancyFilter}
                onChange={(event) => setOccupancyFilter(event.target.value)}
              />
              <button className="ghost-button" onClick={handleExportOccupancy} type="button">
                Export CSV
              </button>
              <button className="ghost-button" onClick={handleManualRefresh} type="button">
                Refresh
              </button>
            </div>
          </div>

          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patente</th>
                  <th>Space Code</th>
                  <th>Zone</th>
                  <th>Entry Time</th>
                  <th>User Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredOccupancies.length > 0 ? (
                  filteredOccupancies.map((item) => (
                    <tr
                      key={item.id_ocupacion}
                      onClick={() => focusSpotByCode(item.codigo_espacio)}
                    >
                      <td className="mono-cell">{item.patente}</td>
                      <td className="mono-cell">{item.codigo_espacio}</td>
                      <td>{item.zona ?? 'Sin zona'}</td>
                      <td>{formatClock(item.fecha_ingreso)}</td>
                      <td>{item.usuario_nombre}</td>
                      <td>
                        <span className={`badge ${getTableStatusClass(item.estado)}`}>
                          {item.estado}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="empty-row" colSpan={6}>
                      No hay ocupaciones que coincidan con el filtro actual.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="table-foot">
            <span>
              Showing {filteredOccupancies.length} of {occupancy.ocupaciones_activas.length} active sessions
            </span>
            <span>Refresco sugerido: {occupancy.refresh_sugerido_segundos ?? 30}s</span>
          </div>
        </section>

        <div className="stack-column">
          <article className="camera-card">
            <div className="camera-status">
              <span className="live-dot"></span>
              LIVE GATE A1
            </div>
            <div className="camera-visual">
              <div className="camera-overlay"></div>
              <div className="camera-target"></div>
            </div>
            <div className="camera-copy">
              <p>ZONE A1 - MAIN INGRESS</p>
              <strong>{latestDetection?.patente ?? 'Sin deteccion'}</strong>
              <span>
                Last detection: {latestDetection ? formatRelativeMinutes(latestDetection.fecha_ingreso) : 'Sin lectura reciente'}
              </span>
            </div>
          </article>

          <section className="surface-card">
            <div className="card-header">
              <div>
                <p className="section-kicker">Mapa fijo</p>
                <h2>Plano estatico de 110 plazas</h2>
              </div>
              <span className="inline-note">{visibleParkingSpotCount} visibles</span>
            </div>

            <div className="heatmap-summary">
              <MetricMini label="Total plano" value={String(staticParkingSpotCount)} />
              <MetricMini label="Habilitadas" value={String(linkedParkingSpotCount)} />
              <MetricMini label="Deshabilitadas" value={String(disabledParkingSpotCount)} />
              <MetricMini label="Seleccion" value={selectedParkingSpot.label} />
            </div>

            <div className="legend-row">
              <LegendItem label="Disponible" tone="disponible" />
              <LegendItem label="Ocupado" tone="ocupado" />
              <LegendItem label="Reservado" tone="reservado" />
              <LegendItem label="Bloqueado" tone="bloqueado" />
              <LegendItem label="Deshabilitado" tone="deshabilitado" />
            </div>

            <div className="heatmap-shell">
              {parkingRows.map((row, rowIndex) => (
                <div className="heatmap-row" key={row[0]?.id ?? `row-${rowIndex}`}>
                  <div className="heatmap-row-label">
                    <strong>Sector {row[0]?.sector}</strong>
                    <span>{row.length} plazas</span>
                  </div>
                  <div className="heatmap-spots">
                    {row.map((spot) => {
                      const isVisible = matchesSpotFilter(spot, deferredFilter)
                      return (
                        <button
                          key={spot.id}
                          className={[
                            'heatmap-spot',
                            getParkingSpotClassName(spot.visualState),
                            selectedParkingSpot.id === spot.id ? 'selected' : '',
                            spot.isEnabled ? 'is-enabled' : 'is-disabled',
                            isVisible ? '' : 'muted',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          disabled={!spot.isEnabled}
                          onClick={() => {
                            if (spot.isEnabled) {
                              setSelectedParkingSpotId(spot.id)
                            }
                          }}
                          type="button"
                        >
                          <span>{String(spot.sequence).padStart(2, '0')}</span>
                          <strong>{spot.sector}</strong>
                          <small>{spot.linkedSpace ? 'BD' : 'OFF'}</small>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="detail-card">
              <div className="detail-head">
                <p className="section-kicker">Detalle</p>
                <h3>{selectedParkingSpot.label}</h3>
              </div>
              <div className="detail-grid">
                <DetailItem label="Estado visual" value={getVisualStateLabel(selectedParkingSpot.visualState)} />
                <DetailItem label="Relacion" value={getSpotSourceLabel(selectedParkingSpot)} />
                <DetailItem label="Codigo BD" value={selectedParkingSpot.actualCode ?? 'Sin vinculo'} />
                <DetailItem label="Zona" value={selectedParkingSpot.linkedSpace?.zona ?? 'Plaza deshabilitada'} />
                <DetailItem label="Tipo" value={selectedParkingSpot.linkedSpace?.tipo ?? 'No definido'} />
                <DetailItem label="Patente activa" value={selectedParkingSpot.linkedOccupancy?.patente ?? 'Sin ocupacion'} />
                <DetailItem label="Usuario activo" value={selectedParkingSpot.linkedOccupancy?.usuario_nombre ?? 'Sin ocupacion'} />
                <DetailItem label="Ingreso" value={formatDateTime(selectedParkingSpot.linkedOccupancy?.fecha_ingreso)} />
              </div>
              <p className="muted-copy">
                Las 110 plazas se dibujan siempre. Solo las plazas asociadas a la BD quedan habilitadas y toman el color segun su estado real.
              </p>
            </div>
          </section>
        </div>
      </div>
    </section>
  )

  const renderOperationsView = () => (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <p className="section-kicker">Ingress / Egress</p>
          <h1>Control de accesos</h1>
          <p className="page-copy">
            Registro de ingresos, salidas y trazabilidad operativa del terminal.
          </p>
        </div>
        <div className="actor-header-badge">
          <span className="material-symbols-outlined">badge</span>
          <span>X-Actor-User-Id: {actorUserId || '--'}</span>
        </div>
      </div>

      <div className="operations-grid">
        <section className="surface-card surface-card-wide">
          <div className="card-header">
            <div>
              <p className="section-kicker">Gate 04</p>
              <h2>Registro de ingreso</h2>
            </div>
            <span className="gate-chip">LIVE GATE 04</span>
          </div>

          <form className="form-grid" onSubmit={submitIngress}>
            <label>
              <span>User ID / operador</span>
              <select
                value={ingressForm.id_usuario}
                onChange={(event) =>
                  setIngressForm((prev) => ({
                    ...prev,
                    id_usuario: event.target.value,
                  }))
                }
              >
                <option value="">Selecciona un usuario</option>
                {users.map((user) => (
                  <option key={user.id_usuario} value={user.id_usuario}>
                    {user.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Vehicle plate ID</span>
              <select
                value={ingressForm.id_vehiculo}
                onChange={(event) => {
                  const nextVehicleId = event.target.value
                  const linkedVehicle = vehicles.find(
                    (vehicle) => String(vehicle.id_vehiculo) === nextVehicleId,
                  )

                  setIngressForm((prev) => ({
                    ...prev,
                    id_vehiculo: nextVehicleId,
                    id_usuario:
                      linkedVehicle && !prev.id_usuario
                        ? String(linkedVehicle.id_usuario)
                        : prev.id_usuario,
                  }))
                }}
              >
                <option value="">Selecciona un vehiculo</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id_vehiculo} value={vehicle.id_vehiculo}>
                    {vehicle.patente} - {vehicle.marca ?? 'Sin marca'}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-span-2">
              <span>Assigned space ID</span>
              <select
                value={ingressForm.id_espacio}
                onChange={(event) =>
                  setIngressForm((prev) => ({
                    ...prev,
                    id_espacio: event.target.value,
                  }))
                }
              >
                <option value="">Selecciona un espacio disponible</option>
                {spaces
                  .filter((space) => space.estado === 'disponible')
                  .map((space) => (
                    <option key={space.id_espacio} value={space.id_espacio}>
                      {space.codigo} - {space.zona ?? 'Sin zona'}
                    </option>
                  ))}
              </select>
            </label>

            <label className="field-span-2">
              <span>Observaciones</span>
              <textarea
                rows={4}
                value={ingressForm.observacion}
                onChange={(event) =>
                  setIngressForm((prev) => ({
                    ...prev,
                    observacion: event.target.value,
                  }))
                }
                placeholder="Inspeccion de carga, vehiculo de visita, observacion operativa..."
              />
            </label>

            <div className="field-span-2">
              <button className="primary-button primary-button-wide" type="submit">
                <span className="material-symbols-outlined">verified_user</span>
                Register entry and open barrier
              </button>
            </div>
          </form>

          {lastIngress ? (
            <div className="lookup-result">
              <div>
                <span className="section-kicker">Ultimo ingreso autorizado</span>
                <strong className="mono-cell">#OCC-{lastIngress.id_ocupacion}</strong>
              </div>
              <div className="lookup-metadata">
                <DetailItem label="Usuario" value={`#${lastIngress.id_usuario}`} />
                <DetailItem label="Vehiculo" value={`#${lastIngress.id_vehiculo}`} />
                <DetailItem label="Espacio" value={`#${lastIngress.id_espacio}`} />
                <DetailItem label="Ingreso" value={formatDateTime(lastIngress.fecha_ingreso)} />
              </div>
            </div>
          ) : null}
        </section>

        <div className="stack-column">
          <section className="surface-card">
            <div className="card-header">
              <div>
                <p className="section-kicker">Lookup</p>
                <h2>Registro de salida</h2>
              </div>
            </div>

            <form className="lookup-form" onSubmit={handleLocationSearch}>
              <label>
                <span>Search by plate</span>
                <div className="input-with-button">
                  <input
                    value={locationPatente}
                    onChange={(event) =>
                      setLocationPatente(event.target.value.toUpperCase())
                    }
                    placeholder="ABC-1234"
                  />
                  <button className="ghost-button" type="submit">
                    Buscar
                  </button>
                </div>
              </label>
            </form>

            {locationResult ? (
              <div className="lookup-result">
                <div>
                  <span className="section-kicker">Ubicacion activa</span>
                  <strong className="mono-cell">{locationResult.patente}</strong>
                </div>
                <div className="lookup-metadata">
                  <DetailItem label="Ocupacion" value={`#${locationResult.id_ocupacion}`} />
                  <DetailItem label="Espacio" value={locationResult.codigo_espacio} />
                  <DetailItem label="Zona" value={locationResult.zona ?? 'Sin zona'} />
                  <DetailItem label="Ingreso" value={formatDateTime(locationResult.fecha_ingreso)} />
                </div>
              </div>
            ) : null}

            <form className="form-grid compact-form" onSubmit={submitExit}>
              <label>
                <span>Occupancy ID</span>
                <input
                  value={exitForm.id_ocupacion}
                  onChange={(event) =>
                    setExitForm((prev) => ({
                      ...prev,
                      id_ocupacion: event.target.value,
                    }))
                  }
                  placeholder="Opcional"
                />
              </label>
              <label>
                <span>Plate</span>
                <input
                  value={exitForm.patente}
                  onChange={(event) =>
                    setExitForm((prev) => ({
                      ...prev,
                      patente: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Opcional si usas ID"
                />
              </label>
              <label className="field-span-2">
                <span>Observacion</span>
                <textarea
                  rows={3}
                  value={exitForm.observacion}
                  onChange={(event) =>
                    setExitForm((prev) => ({
                      ...prev,
                      observacion: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="field-span-2">
                <button className="secondary-alert-button" type="submit">
                  <span className="material-symbols-outlined">door_open</span>
                  Authorize exit
                </button>
              </div>
            </form>
          </section>

          <article className="camera-card camera-card-alt">
            <div className="camera-status">
              <span className="live-dot"></span>
              LIVE GATE CAM 04
            </div>
            <div className="camera-visual camera-visual-alt">
              <div className="camera-overlay"></div>
              <div className="camera-crosshair"></div>
            </div>
            <div className="camera-copy">
              <p>LPR Recognition Active</p>
              <strong>{actor ? actor.nombre : 'Sin supervisor'}</strong>
              <span>{lastExit ? `Ultima salida: ${formatClock(lastExit.fecha_salida)}` : 'Sin salida reciente'}</span>
            </div>
          </article>
        </div>

        <section className="surface-card operations-log">
          <div className="card-header">
            <div>
              <p className="section-kicker">Recent operations</p>
              <h2>Bitacora operacional</h2>
            </div>
            <button className="ghost-button" onClick={handleManualRefresh} type="button">
              View latest
            </button>
          </div>

          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Plate</th>
                  <th>Space</th>
                  <th>Status</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {recentOperations.map((item) => (
                  <tr key={item.id}>
                    <td>{formatClock(item.timestamp)}</td>
                    <td>
                      <span className={`badge ${item.type === 'salida' ? 'badge-danger' : item.type === 'consulta' ? 'badge-neutral' : 'badge-positive'}`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="mono-cell">{item.patente}</td>
                    <td className="mono-cell">{item.espacio}</td>
                    <td>
                      <span className={`badge ${getTableStatusClass(item.estado)}`}>
                        {item.estado}
                      </span>
                    </td>
                    <td>{item.detalle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  )

  const renderCatalogView = () => (
    <section className="page-shell">
      <div className="page-header">
        <div>
          <p className="section-kicker">Catalog Browser</p>
          <h1>Catalogo del sistema</h1>
          <p className="page-copy">
            Gestion de recursos base, definiciones y registros maestros del
            estacionamiento.
          </p>
        </div>
        <div className="header-actions">
          <button className="ghost-button" onClick={handleExportCatalog} type="button">
            Export CSV
          </button>
          <button className="primary-button" onClick={() => setCatalogModalOpen(true)} type="button">
            <span className="material-symbols-outlined">add</span>
            {actionLabelByTab[catalogTab]}
          </button>
        </div>
      </div>

      <div className="catalog-tabs">
        {catalogTabs.map((tab) => (
          <button
            key={tab.key}
            className={catalogTab === tab.key ? 'catalog-tab active' : 'catalog-tab'}
            onClick={() => {
              startTransition(() => {
                setCatalogTab(tab.key)
              })
            }}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="catalog-grid">
        <section className="surface-card surface-card-wide">
          <div className="card-header">
            <div>
              <p className="section-kicker">System registry</p>
              <h2>{activeCatalogLabel}</h2>
            </div>
            <div className="card-actions">
              <button className="ghost-icon-button" onClick={handleExportCatalog} type="button">
                <span className="material-symbols-outlined">file_download</span>
              </button>
              <button className="ghost-icon-button" onClick={handleManualRefresh} type="button">
                <span className="material-symbols-outlined">refresh</span>
              </button>
            </div>
          </div>

          <div className="table-shell">{renderCatalogTable()}</div>

          <div className="table-foot">
            <span>
              Showing {catalogTab === 'espacios' ? spaces.length : catalogTab === 'vehiculos' ? vehicles.length : catalogTab === 'usuarios' ? users.length : roles.length} records
            </span>
            <span>{loading.catalogo ? 'Sincronizando...' : 'Catalogo listo'}</span>
          </div>
        </section>

        <div className="stack-column">
          <section className="surface-card">
            <div className="card-header">
              <div>
                <p className="section-kicker">Live capacity</p>
                <h2>Capacidad actual</h2>
              </div>
              <span className="status-dot success"></span>
            </div>

            <ProgressMetric
              label="General admission"
              value={`${occupancy.espacios_ocupados} / ${occupancy.total_espacios || 0}`}
              progress={occupancyRate}
              tone="primary"
            />
            <ProgressMetric
              label="EV / carga"
              value={`${chargingSpaceCount} plazas`}
              progress={spaces.length ? Math.round((chargingSpaceCount / spaces.length) * 100) : 0}
              tone="success"
            />
            <ProgressMetric
              label="VIP / reservados"
              value={`${reservedSpaceCount} activas`}
              progress={spaces.length ? Math.round((reservedSpaceCount / spaces.length) * 100) : 0}
              tone="warning"
            />
          </section>

          <section className="surface-card insights-card">
            <div>
              <p className="section-kicker">Catalog insights</p>
              <h2>Vista rapida</h2>
            </div>
            <div className="insight-grid">
              <DetailItem label="Usuarios activos" value={String(activeUserCount)} />
              <DetailItem label="Vehiculos activos" value={String(activeVehicleCount)} />
              <DetailItem label="Roles" value={String(roles.length)} />
              <DetailItem label="Plazas mapeadas" value={String(linkedParkingSpotCount)} />
            </div>

            <div className="zone-list">
              {zoneUsage.length > 0 ? (
                zoneUsage.map(([zone, count]) => (
                  <div className="zone-item" key={zone}>
                    <span>{zone}</span>
                    <strong>{count}</strong>
                  </div>
                ))
              ) : (
                <p className="muted-copy">Sin zonas activas para mostrar.</p>
              )}
            </div>
          </section>

          <section className="surface-card audit-card">
            <div className="audit-head">
              <span className="material-symbols-outlined">security</span>
              <div>
                <p>Audit integrity</p>
                <strong>Logs operativos visibles</strong>
              </div>
            </div>
            <button className="ghost-button full-width" onClick={handleManualRefresh} type="button">
              Request permission sync
            </button>
          </section>
        </div>
      </div>
    </section>
  )

  return (
    <>
      <div className="control-shell">
        <aside className="sidebar-shell">
          <div className="sidebar-top">
            <div className="brand-block">
              <span className="brand-mark">A1</span>
              <div>
                <p className="section-kicker">Terminal A1</p>
                <h2>PARK_CONTROL_SYSTEM</h2>
                <span>Shift Manager ID: 8824</span>
              </div>
            </div>

            <nav className="sidebar-nav">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  className={activeView === item.key ? 'nav-link active' : 'nav-link'}
                  onClick={() => {
                    startTransition(() => {
                      setActiveView(item.key)
                    })
                  }}
                  type="button"
                >
                  <span className="material-symbols-outlined nav-icon">{item.icon}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.subtitle}</small>
                  </div>
                </button>
              ))}
            </nav>
          </div>

          <div className="sidebar-bottom">
            <button className="override-button" onClick={handleEmergencyOverride} type="button">
              <span className="material-symbols-outlined">warning</span>
              Emergency override
            </button>

            <div className="sidebar-meta">
              <span>API base</span>
              <code>{import.meta.env.VITE_API_BASE_URL ?? '/api/v1'}</code>
              <span>DB: {health?.database ?? 'Sin validar'}</span>
            </div>
          </div>
        </aside>

        <div className="stage-shell">
          <header className="topbar-shell">
            <div className="topbar-brand">
              <strong>PARK_CONTROL_SYSTEM</strong>
              <span>Occupancy + Access + Catalog</span>
            </div>

            <form className="topbar-search" onSubmit={handleTopSearch}>
              <span className="material-symbols-outlined">search</span>
              <input
                value={globalSearchPlate}
                onChange={(event) => setGlobalSearchPlate(event.target.value.toUpperCase())}
                placeholder="Search Vehicle Location (GET /operaciones/ubicacion)"
              />
            </form>

            <div className="topbar-tools">
              <label className="actor-field">
                <span>Actor</span>
                <select
                  value={actorUserId}
                  onChange={(event) => setActorUserId(event.target.value)}
                >
                  <option value="">Selecciona un usuario</option>
                  {users.map((user) => (
                    <option key={user.id_usuario} value={user.id_usuario}>
                      #{user.id_usuario} - {user.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <div className="actor-pill">
                <span className="material-symbols-outlined">badge</span>
                <div>
                  <strong>{actor ? actor.nombre : 'Sin actor'}</strong>
                  <small>{actor ? `${actorRole} · X-Actor-User-Id ${actor.id_usuario}` : 'Seleccion pendiente'}</small>
                </div>
              </div>

              <button className="icon-action" onClick={() => void refreshHealth()} type="button">
                <span className="material-symbols-outlined">health_metrics</span>
              </button>
              <button className="icon-action" onClick={handleManualRefresh} type="button">
                <span className="material-symbols-outlined">sync</span>
              </button>
            </div>
          </header>

          <main className="content-shell">
            {health?.detail ? (
              <section className="inline-banner">
                <span className="material-symbols-outlined">info</span>
                <div>
                  <strong>Estado del backend</strong>
                  <p>{health.detail}</p>
                </div>
              </section>
            ) : null}

            {activeView === 'ocupacion' ? renderOccupancyView() : null}
            {activeView === 'operaciones' ? renderOperationsView() : null}
            {activeView === 'catalogo' ? renderCatalogView() : null}
          </main>
        </div>
      </div>

      {message ? (
        <div className={`toast-shell toast-${message.tone}`}>
          <span className="material-symbols-outlined">
            {message.tone === 'exito'
              ? 'check_circle'
              : message.tone === 'error'
                ? 'error'
                : 'info'}
          </span>
          <div>
            <strong>{message.title}</strong>
            <p>{message.text}</p>
          </div>
          <button className="toast-close" onClick={() => setMessage(null)} type="button">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      ) : null}

      {renderCatalogModal()}
    </>
  )
}

function MetricCard({
  label,
  value,
  progress,
  tone,
}: {
  label: string
  value: string
  progress: number
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <div className="metric-bar">
        <div className={`metric-fill ${tone}`} style={{ width: `${Math.max(6, progress)}%` }}></div>
      </div>
    </article>
  )
}

function MetricMini({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="metric-mini">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function LegendItem({
  label,
  tone,
}: {
  label: string
  tone: ParkingVisualState
}) {
  return (
    <div className="legend-item">
      <span className={`legend-dot ${getParkingSpotClassName(tone)}`}></span>
      <span>{label}</span>
    </div>
  )
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ProgressMetric({
  label,
  value,
  progress,
  tone,
}: {
  label: string
  value: string
  progress: number
  tone: 'primary' | 'success' | 'warning'
}) {
  return (
    <div className="progress-metric">
      <div className="progress-head">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="progress-track">
        <div className={`progress-fill ${tone}`} style={{ width: `${Math.max(4, progress)}%` }}></div>
      </div>
    </div>
  )
}

export default App
