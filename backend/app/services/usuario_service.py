import re

from fastapi import HTTPException, status
from psycopg.errors import IntegrityError
from psycopg.types.json import Jsonb

from app.database.connection import get_connection
from app.schemas.usuario_schema import UsuarioCreate, UsuarioUpdate


class UsuarioService:
	_campos = ("user_id", "nome", "uid_card", "vetor_facial", "ativo", "criado_em")

	@classmethod
	def _row_to_dict(cls, row):
		return dict(zip(cls._campos, row, strict=True))

	@staticmethod
	def _normalizar_uid(uid_card: str | None) -> str | None:
		if uid_card is None:
			return None
		return re.sub(r"[\s:-]", "", uid_card).upper() or None

	def listar_locais(self):
		with get_connection() as connection:
			with connection.cursor() as cursor:
				cursor.execute(
					"""
					SELECT local_id, nome, identificador_dispositivo
					FROM local
					WHERE ativo = TRUE
					ORDER BY nome
					"""
				)
				return [
					{"local_id": row[0], "nome": row[1], "identificador_dispositivo": row[2]}
					for row in cursor.fetchall()
				]

	def listar_usuarios(self):
		with get_connection() as connection:
			with connection.cursor() as cursor:
				cursor.execute(
					"""
					SELECT user_id, nome, uid_card, vetor_facial, ativo, criado_em
					FROM usuario
					ORDER BY user_id
					"""
				)
				return [self._row_to_dict(row) for row in cursor.fetchall()]

	def obter_usuario(self, usuario_id: int):
		with get_connection() as connection:
			with connection.cursor() as cursor:
				cursor.execute(
					"""
					SELECT user_id, nome, uid_card, vetor_facial, ativo, criado_em
					FROM usuario
					WHERE user_id = %s
					""",
					(usuario_id,),
				)
				usuario = cursor.fetchone()

		if usuario is None:
			raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
		return self._row_to_dict(usuario)

	def criar_usuario(self, usuario: UsuarioCreate):
		try:
			with get_connection() as connection:
				with connection.cursor() as cursor:
					cursor.execute(
						"""
						INSERT INTO usuario (nome, uid_card, vetor_facial, ativo)
						VALUES (%s, %s, %s, %s)
						RETURNING user_id, nome, uid_card, vetor_facial, ativo, criado_em
						""",
						(
							usuario.nome,
							self._normalizar_uid(usuario.uid_card),
							Jsonb(usuario.vetor_facial) if usuario.vetor_facial is not None else None,
							usuario.ativo,
						),
					)
					criado = cursor.fetchone()
					for permissao in usuario.permissoes:
						cursor.execute(
							"""
							INSERT INTO permissao (
								usuario_id, local_id, horario_inicio, horario_fim, dias_semana
							) VALUES (%s, %s, %s, %s, %s)
							""",
							(
								criado[0],
								permissao.local_id,
								permissao.horario_inicio,
								permissao.horario_fim,
								permissao.dias_semana,
							),
						)
		except IntegrityError as error:
			raise HTTPException(
				status_code=status.HTTP_409_CONFLICT,
				detail="O cartão informado já está cadastrado.",
			) from error

		return self._row_to_dict(criado)

	def atualizar_usuario(self, usuario_id: int, usuario: UsuarioUpdate):
		campos = usuario.model_dump(exclude_unset=True)
		if not campos:
			return self.obter_usuario(usuario_id)

		valores = [
			self._normalizar_uid(campos[nome]) if nome == "uid_card" else
			Jsonb(campos[nome]) if nome == "vetor_facial" and campos[nome] is not None else campos[nome]
			for nome in campos
		]
		atribuicoes = ", ".join(f"{nome} = %s" for nome in campos)
		valores.append(usuario_id)

		try:
			with get_connection() as connection:
				with connection.cursor() as cursor:
					cursor.execute(
						f"""
						UPDATE usuario
						SET {atribuicoes}
						WHERE user_id = %s
						RETURNING user_id, nome, uid_card, vetor_facial, ativo, criado_em
						""",
						valores,
					)
					atualizado = cursor.fetchone()
		except IntegrityError as error:
			raise HTTPException(
				status_code=status.HTTP_409_CONFLICT,
				detail="O cartão informado já está cadastrado.",
			) from error

		if atualizado is None:
			raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
		return self._row_to_dict(atualizado)

	def atualizar_vetor_facial(self, usuario_id: int, vetor_facial: list[float]):
		with get_connection() as connection:
			with connection.cursor() as cursor:
				cursor.execute(
					"""
					UPDATE usuario
					SET vetor_facial = %s
					WHERE user_id = %s
					RETURNING user_id
					""",
					(Jsonb(vetor_facial), usuario_id),
				)
				atualizado = cursor.fetchone()

		if atualizado is None:
			raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
		return atualizado[0]

	def deletar_usuario(self, usuario_id: int):
		with get_connection() as connection:
			with connection.cursor() as cursor:
				cursor.execute(
					"DELETE FROM usuario WHERE user_id = %s RETURNING user_id",
					(usuario_id,),
				)
				removido = cursor.fetchone()

		if removido is None:
			raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
		return {"mensagem": "Usuário excluído com sucesso."}


usuario_service = UsuarioService()
