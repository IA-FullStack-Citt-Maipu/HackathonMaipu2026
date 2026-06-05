import type { OccupancyCurrentItem, ParkingSpace } from './types'

export type ParkingVisualState = ParkingSpace['estado'] | 'deshabilitado'

export interface ManualParkingSpot {
  id: string
  label: string
  sector: string
  sequence: number
  rowIndex: number
  columnIndex: number
}

export interface ManualParkingSpotView extends ManualParkingSpot {
  linkedSpace: ParkingSpace | null
  linkedOccupancy: OccupancyCurrentItem | null
  visualState: ParkingVisualState
  source: 'deshabilitada' | 'bd-exacta' | 'bd-asignada'
  actualCode: string | null
  isEnabled: boolean
}

const sectors = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
const spacesPerSector = 11

export const MANUAL_PARKING_SPOTS: ManualParkingSpot[] = sectors.flatMap(
  (sector, rowIndex) =>
    Array.from({ length: spacesPerSector }, (_, columnIndex) => {
      const sequence = columnIndex + 1

      return {
        id: `${sector}-${String(sequence).padStart(2, '0')}`,
        label: `${sector}-${String(sequence).padStart(2, '0')}`,
        sector,
        sequence,
        rowIndex,
        columnIndex,
      }
    }),
)

export function normalizeParkingCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/\d+/g, (digits) => String(Number(digits)))
}

export function buildManualParkingMap(
  spaces: ParkingSpace[],
  occupancies: OccupancyCurrentItem[],
): ManualParkingSpotView[] {
  const spacesByCode = new Map(
    spaces.map((space) => [normalizeParkingCode(space.codigo), space]),
  )
  const occupancyByCode = new Map(
    occupancies.map((item) => [normalizeParkingCode(item.codigo_espacio), item]),
  )
  const matchedCodes = new Set<string>()

  const exactMapped = MANUAL_PARKING_SPOTS.map<ManualParkingSpotView>((spot) => {
    const linkedSpace = spacesByCode.get(normalizeParkingCode(spot.label)) ?? null

    if (linkedSpace) {
      matchedCodes.add(normalizeParkingCode(linkedSpace.codigo))
    }

    return {
      ...spot,
      linkedSpace,
      linkedOccupancy: linkedSpace
        ? occupancyByCode.get(normalizeParkingCode(linkedSpace.codigo)) ?? null
        : null,
      visualState: linkedSpace?.estado ?? 'deshabilitado',
      source: linkedSpace ? 'bd-exacta' : 'deshabilitada',
      actualCode: linkedSpace?.codigo ?? null,
      isEnabled: linkedSpace !== null,
    }
  })

  const remainingSpaces = spaces.filter(
    (space) => !matchedCodes.has(normalizeParkingCode(space.codigo)),
  )

  let remainingIndex = 0

  return exactMapped.map((spot) => {
    if (spot.linkedSpace || remainingIndex >= remainingSpaces.length) {
      return spot
    }

    const linkedSpace = remainingSpaces[remainingIndex]
    remainingIndex += 1

    return {
      ...spot,
      linkedSpace,
      linkedOccupancy:
        occupancyByCode.get(normalizeParkingCode(linkedSpace.codigo)) ?? null,
      visualState: linkedSpace.estado,
      source: 'bd-asignada',
      actualCode: linkedSpace.codigo,
      isEnabled: true,
    }
  })
}
