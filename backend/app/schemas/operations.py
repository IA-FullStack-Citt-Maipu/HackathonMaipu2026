from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class OccupancyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_ocupacion: int
    id_usuario: int
    id_vehiculo: int
    id_espacio: int
    fecha_ingreso: datetime
    fecha_salida: datetime | None
    estado: str
    observacion: str | None


class OccupancyCurrentItem(BaseModel):
    id_ocupacion: int
    id_usuario: int
    usuario_nombre: str
    id_vehiculo: int
    patente: str
    id_espacio: int
    codigo_espacio: str
    zona: str | None
    fecha_ingreso: datetime
    estado: str


class OccupancySummary(BaseModel):
    total_espacios: int
    espacios_disponibles: int
    espacios_ocupados: int
    espacios_reservados: int
    espacios_bloqueados: int
    espacios_mantenimiento: int
    refresh_sugerido_segundos: int | None = None
    ocupaciones_activas: list[OccupancyCurrentItem]


class VehicleIngressCreate(BaseModel):
    id_usuario: int
    id_vehiculo: int
    id_espacio: int
    id_reserva: int | None = None
    observacion: str | None = None


class VehicleLocationRead(BaseModel):
    id_ocupacion: int
    patente: str
    codigo_espacio: str
    zona: str | None
    fecha_ingreso: datetime
    estado: str


class VehicleExitCreate(BaseModel):
    id_ocupacion: int | None = None
    patente: str | None = None
    observacion: str | None = None


class VehicleExitRead(BaseModel):
    id_ocupacion: int
    fecha_salida: datetime
    estado: Literal["finalizada"]
    espacio_liberado: str


class SystemParameterUpsert(BaseModel):
    clave: str = Field(min_length=2, max_length=100)
    valor: str = Field(min_length=1)
    descripcion: str | None = None


class SystemParameterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_parametro: int
    clave: str
    valor: str
    descripcion: str | None
    fecha_actualizacion: datetime
