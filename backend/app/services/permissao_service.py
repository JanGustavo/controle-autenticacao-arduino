from fastapi import HTTPException, status
from psycopg.errors import ForeignKeyViolation, IntegrityError

from app.database.connection import get_connection
from app.schemas.permissao_schema import PermissaoCreate, PermissaoUpdate


class PermissaoService:
	_campos = (
		"permissao_id",
		"usuario_id",
		"local_id",
		"horario_inicio",
		"horario_fim",
		"dias_semana",
	)

	@classmethod
	def _row_to_dict(cls, row):
		return dict(zip(cls._campos, row, strict=True))

	def listar_permissoes(self, q: str | None = None, usuario_id: int | None = None, local_id: int | None = None):
		conditions = []
		params = []
		if q is not None and q.strip():
			term = f"%{q.strip().lower()}%"
			conditions.append("(LOWER(u.nome) LIKE %s OR LOWER(l.nome) LIKE %s)")
			params.extend([term, term])
		if usuario_id is not None:
			conditions.append("p.usuario_id = %s")
			params.append(usuario_id)
		if local_id is not None:
			conditions.append("p.local_id = %s")
			params.append(local_id)

		where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

		with get_connection() as connection:
			with connection.cursor() as cursor:
				cursor.execute(
					"""
					SELECT permissao_id, usuario_id, local_id,
						  c
						  horario_inicio, horario_fim, dias_semana
					FROM permissao
					ORDER BY permissao_id
					"""
				)
				return [self._row_to_dict(row) for row in cursor.fetchall()]

	def obter_permissao(self, permissao_id: int):
		with get_connection() as connection:
			with connection.cursor() as cursor:
				cursor.execute(
					"""
					SELECT permissao_id, usuario_id, local_id,
						   horario_inicio, horario_fim, dias_semana
					FROM permissao
					WHERE permissao_id = %s
					""",
					(permissao_id,),
				)
				permissao = cursor.fetchone()

		if permissao is None:
			raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permissão não encontrada.")
		return self._row_to_dict(permissao)

	def criar_permissao(self, permissao: PermissaoCreate):
		try:
			with get_connection() as connection:
				with connection.cursor() as cursor:
					cursor.execute(
						"""
						INSERT INTO permissao (
							usuario_id, local_id, horario_inicio, horario_fim, dias_semana
						) VALUES (%s, %s, %s, %s, %s)
						RETURNING permissao_id, usuario_id, local_id,
								  horario_inicio, horario_fim, dias_semana
						""",
						(
							permissao.usuario_id,
							permissao.local_id,
							permissao.horario_inicio,
							permissao.horario_fim,
							permissao.dias_semana,
						),
					)
					criada = cursor.fetchone()
		except ForeignKeyViolation as error:
			raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário ou local não encontrado.") from error
		except IntegrityError as error:
			raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe uma permissão para este usuário e local.") from error

		return self._row_to_dict(criada)

	def atualizar_permissao(self, permissao_id: int, permissao: PermissaoUpdate):
		campos = permissao.model_dump(exclude_unset=True)
		if not campos:
			return self.obter_permissao(permissao_id)

		valores = [campos[nome] for nome in campos]
		atribuicoes = ", ".join(f"{nome} = %s" for nome in campos)
		valores.append(permissao_id)

		try:
			with get_connection() as connection:
				with connection.cursor() as cursor:
					cursor.execute(
						f"""
						UPDATE permissao
						SET {atribuicoes}
						WHERE permissao_id = %s
						RETURNING permissao_id, usuario_id, local_id,
								  horario_inicio, horario_fim, dias_semana
						""",
						valores,
					)
					atualizada = cursor.fetchone()
		except ForeignKeyViolation as error:
			raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local não encontrado.") from error
		except IntegrityError as error:
			raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe uma permissão para este usuário e local.") from error

		if atualizada is None:
			raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permissão não encontrada.")
		return self._row_to_dict(atualizada)

	def deletar_permissao(self, permissao_id: int):
		with get_connection() as connection:
			with connection.cursor() as cursor:
				cursor.execute(
					"DELETE FROM permissao WHERE permissao_id = %s RETURNING permissao_id",
					(permissao_id,),
				)
				removida = cursor.fetchone()

		if removida is None:
			raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permissão não encontrada.")
		return {"mensagem": "Permissão excluída com sucesso."}


permissao_service = PermissaoService()
