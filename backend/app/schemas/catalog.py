from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


UserStatus = Literal["activo", "inactivo", "bloqueado"]
VehicleType = Literal["auto", "moto", "camioneta", "otro"]
SpaceType = Literal["normal", "discapacitado", "visita", "carga", "otro"]
SpaceStatus = Literal[
    "disponible",
    "ocupado",
    "reservado",
    "bloqueado",
    "mantenimiento",
]


class RoleCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=50)
    descripcion: str | None = Field(default=None, max_length=255)


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_rol: int
    nombre: str
    descripcion: str | None


class UserCreate(BaseModel):
    id_rol: int
    nombre: str = Field(min_length=2, max_length=100)
    correo: EmailStr
    password_hash: str = Field(min_length=6, max_length=255)
    telefono: str | None = Field(default=None, max_length=30)
    estado: UserStatus = "activo"


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_usuario: int
    id_rol: int
    nombre: str
    correo: EmailStr
    telefono: str | None
    estado: UserStatus
    fecha_creacion: datetime


class VehicleCreate(BaseModel):
    id_usuario: int
    patente: str = Field(min_length=4, max_length=20)
    marca: str | None = Field(default=None, max_length=50)
    modelo: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=30)
    tipo: VehicleType = "auto"
    activo: bool = True


class VehicleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_vehiculo: int
    id_usuario: int
    patente: str
    marca: str | None
    modelo: str | None
    color: str | None
    tipo: VehicleType
    activo: bool


class ParkingSpaceCreate(BaseModel):
    codigo: str = Field(min_length=1, max_length=20)
    zona: str | None = Field(default=None, max_length=50)
    tipo: SpaceType = "normal"
    estado: SpaceStatus = "disponible"
    es_doble: bool = False
    activo: bool = True


class ParkingSpaceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_espacio: int
    codigo: str
    zona: str | None
    tipo: SpaceType
    estado: SpaceStatus
    es_doble: bool
    activo: bool
