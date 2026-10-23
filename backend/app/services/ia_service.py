"""Read-only access statistics and Groq explanation for the admin assistant."""

import json
import os
from itertools import count
from threading import Lock

import httpx

from app.database.connection import get_connection


_key_index = count()
_key_lock = Lock()


def resumo_acessos() -> dict:
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT u.user_id, u.nome, u.ativo,
                   COUNT(h.id) AS total,
                   COUNT(h.id) FILTER (WHERE h.autorizado IS TRUE) AS aceitos,
                   COUNT(h.id) FILTER (WHERE h.autorizado IS FALSE) AS negados
            FROM usuario u
            LEFT JOIN historico_acesso h ON h.usuario_id = u.user_id
            GROUP BY u.user_id, u.nome, u.ativo
            ORDER BY u.nome, u.user_id
            """
        )
        rows = cursor.fetchall()

    usuarios = []
    for user_id, nome, ativo, total, aceitos, negados in rows:
        usuarios.append({
            "id": user_id,
            "nome": nome,
            "ativo": ativo,
            "total": total,
            "aceitos": aceitos,
            "negados": negados,
            "percentual_aceitos": round(aceitos * 100 / total, 1) if total else 0.0,
            "percentual_negados": round(negados * 100 / total, 1) if total else 0.0,
        })

    total = sum(item["total"] for item in usuarios)
    aceitos = sum(item["aceitos"] for item in usuarios)
    negados = sum(item["negados"] for item in usuarios)
    return {
        "usuarios": usuarios,
        "total_usuarios": len(usuarios),
        "total_acessos": total,
        "aceitos": aceitos,
        "negados": negados,
        "percentual_aceitos": round(aceitos * 100 / total, 1) if total else 0.0,
        "percentual_negados": round(negados * 100 / total, 1) if total else 0.0,
    }


def _proxima_chave() -> str | None:
    keys = [os.getenv(f"GROQ_API_KEY_{index}", "").strip() for index in (1, 2, 3)]
    keys = [key for key in keys if key]
    if not keys:
        return None
    with _key_lock:
        return keys[next(_key_index) % len(keys)]


async def responder_com_groq(pergunta: str, resumo: dict) -> str:
    key = _proxima_chave()
    if not key:
        raise RuntimeError("GROQ_API_KEY_1, _2 ou _3 não configurada.")

    payload = {
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        "temperature": 0.2,
        "max_completion_tokens": 700,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Você é o assistente analítico do ArdLock. Responda em português claro, "
                    "usando somente os dados fornecidos. Nunca invente números. "
                    "Os percentuais são por tentativas registradas, não por usuários. "
                    "Quando não houver dados suficientes, diga isso. "
                    "Responda em texto simples, sem HTML ou Markdown."
                ),
            },
            {
                "role": "user",
                "content": f"Dados autorizados (JSON): {json.dumps(resumo, ensure_ascii=False)}\nPergunta: {pergunta}",
            },
        ],
    }
    async with httpx.AsyncClient(timeout=35) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json=payload,
        )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"].strip()
