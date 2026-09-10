from datetime import time

from pydantic import BaseModel, Field, field_validator


class PermissaoBase(BaseModel):
    usuario_id: int | None = Field(default=None, gt=0)
    local_id: int = Field(gt=0)
    horario_inicio: time
    horario_fim: time
    dias_semana: list[int] = Field(max_length=7)

    @field_validator("dias_semana")
    @classmethod
    def validar_dias_semana(cls, dias: list[int]) -> list[int]:
        if any(dia < 1 or dia > 7 for dia in dias):
            raise ValueError("Os dias da semana devem estar entre 1 e 7.")
        if len(set(dias)) != len(dias):
            raise ValueError("Os dias da semana não podem se repetir.")
        return sorted(dias)


class PermissaoCreate(PermissaoBase):
    usuario_id: int = Field(gt=0)
    dias_semana: list[int] = Field(min_length=1, max_length=7)


class PermissaoVinculoCreate(BaseModel):
    local_id: int = Field(gt=0)
    horario_inicio: time
    horario_fim: time
    dias_semana: list[int] = Field(min_length=1, max_length=7)

    @field_validator("dias_semana")
    @classmethod
    def validar_dias_semana(cls, dias: list[int]) -> list[int]:
        if any(dia < 1 or dia > 7 for dia in dias):
            raise ValueError("Os dias da semana devem estar entre 1 e 7.")
        if len(set(dias)) != len(dias):
            raise ValueError("Os dias da semana não podem se repetir.")
        return sorted(dias)


class PermissaoUpdate(BaseModel):
    local_id: int | None = Field(default=None, gt=0)
    horario_inicio: time | None = None
    horario_fim: time | None = None
    dias_semana: list[int] | None = Field(default=None, min_length=1, max_length=7)

    @field_validator("dias_semana")
    @classmethod
    def validar_dias_semana(cls, dias: list[int] | None) -> list[int] | None:
        if dias is None:
            return None
        if any(dia < 1 or dia > 7 for dia in dias):
            raise ValueError("Os dias da semana devem estar entre 1 e 7.")
        if len(set(dias)) != len(dias):
            raise ValueError("Os dias da semana não podem se repetir.")
        return sorted(dias)


class PermissaoResponse(PermissaoBase):
    permissao_id: int
    usuario_id: int
