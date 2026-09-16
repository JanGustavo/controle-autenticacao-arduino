from typing import Any
from fastapi import HTTPException, status
from psycopg.errors import IntegrityError

from app.auth.security import gerar_hash_senha
from app.database.connection import get_connection
from app.schemas.administrador_schema import (
    AdministradorCreate,
    AdministradorUpdate,
)


class AdministradorService:
    _campos = ("admin_id", "nome", "email", "ativo", "principal", "criado_em")

    @classmethod
    def _row_to_dict(cls, row) -> dict[str, Any]:
        return dict(zip(cls._campos, row, strict=True))

    def listar_administradores(self, q: str | None = None, ativo: bool | None = None) -> list[dict[str, Any]]:
        conditions = []
        params = []
        if q is not None and q.strip():
            term = f"%{q.strip().lower()}%"
            conditions.append("(LOWER(nome) LIKE %s OR LOWER(email) LIKE %s)")
            params.extend([term, term])
        if ativo is not None:
            conditions.append("ativo = %s")
            params.append(ativo)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT admin_id, nome, email, ativo, principal, criado_em
                    FROM administrador
                    {where_clause}
                    ORDER BY admin_id
                    """,
                    params if params else None,
                )
                return [self._row_to_dict(row) for row in cursor.fetchall()]

    def obter_administrador(self, admin_id: int) -> dict[str, Any]:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT admin_id, nome, email, ativo, principal, criado_em
                    FROM administrador
                    WHERE admin_id = %s
                    """,
                    (admin_id,),
                )
                admin = cursor.fetchone()

        if admin is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Administrador não encontrado.",
            )
        return self._row_to_dict(admin)

    def criar_administrador(self, admin_data: AdministradorCreate) -> dict[str, Any]:
        email_limpo = admin_data.email.strip().lower()
        senha_hash = gerar_hash_senha(admin_data.senha)

        try:
            with get_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO administrador (nome, email, senha_hash, ativo, principal)
                        VALUES (%s, %s, %s, %s, FALSE)
                        RETURNING admin_id, nome, email, ativo, principal, criado_em
                        """,
                        (admin_data.nome.strip(), email_limpo, senha_hash, admin_data.ativo),
                    )
                    criado = cursor.fetchone()
        except IntegrityError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este e-mail já está cadastrado para outro administrador.",
            ) from error

        return self._row_to_dict(criado)

    def atualizar_administrador(
        self, admin_id: int, admin_data: AdministradorUpdate
    ) -> dict[str, Any]:
        atual = self.obter_administrador(admin_id)

        # Regra de Segurança da Conta Principal:
        # A conta principal não pode ser desativada.
        if atual["principal"] and admin_data.ativo is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A conta administrativa principal não pode ser desativada.",
            )

        campos = admin_data.model_dump(exclude_unset=True)
        if not campos:
            return atual

        # Se houver senha, converte para hash bcrypt e remove a senha em texto puro do dict
        if "senha" in campos and campos["senha"]:
            campos["senha_hash"] = gerar_hash_senha(campos["senha"])
            del campos["senha"]

        if "nome" in campos and campos["nome"]:
            campos["nome"] = campos["nome"].strip()

        if "email" in campos and campos["email"]:
            campos["email"] = campos["email"].strip().lower()

        valores = [campos[nome] for nome in campos]
        atribuicoes = ", ".join(f"{nome} = %s" for nome in campos)
        valores.append(admin_id)

        try:
            with get_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        f"""
                        UPDATE administrador
                        SET {atribuicoes}
                        WHERE admin_id = %s
                        RETURNING admin_id, nome, email, ativo, principal, criado_em
                        """,
                        valores,
                    )
                    atualizado = cursor.fetchone()
        except IntegrityError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este e-mail já está cadastrado para outro administrador.",
            ) from error

        if atualizado is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Administrador não encontrado.",
            )
        return self._row_to_dict(atualizado)

    def deletar_administrador(
        self, admin_id: int, admin_autenticado_id: int, admin_autenticado_principal: bool = False
    ) -> dict[str, str]:
        admin_alvo = self.obter_administrador(admin_id)

        # 1. Regra da Conta Principal: a conta principal NUNCA pode ser excluída por ninguém (nem por si mesma).
        if admin_alvo["principal"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A conta administrativa principal do ArdLock não pode ser excluída.",
            )

        # 2. Regra de Autoexclusão para contas comuns:
        # Se NÃO for a conta principal autenticada, impede autoexclusão.
        if not admin_autenticado_principal and admin_id == admin_autenticado_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não é permitido excluir a própria conta logada.",
            )

        # 3. Regra de garantia estrutural de administradores ativos no sistema (para admins comuns)
        with get_connection() as connection:
            with connection.cursor() as cursor:
                if not admin_autenticado_principal:
                    cursor.execute("SELECT COUNT(*) FROM administrador WHERE ativo = TRUE")
                    total_ativos = cursor.fetchone()[0]

                    if total_ativos <= 1 and admin_alvo["ativo"]:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Não é possível excluir o único administrador ativo do sistema.",
                        )

                cursor.execute(
                    "DELETE FROM administrador WHERE admin_id = %s RETURNING admin_id",
                    (admin_id,),
                )
                removido = cursor.fetchone()


        if removido is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Administrador não encontrado.",
            )

        return {"mensagem": "Administrador excluído com sucesso."}


administrador_service = AdministradorService()
