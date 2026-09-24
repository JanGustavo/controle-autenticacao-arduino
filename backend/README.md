# Backend ArdLock

API FastAPI responsável por autenticação administrativa, regras de acesso físico, biometria facial 1:1, auditoria e integração com ESP32/RFID.

> Documentação detalhada: [docs/BACKEND.md](../docs/BACKEND.md)  
> Guia de Swagger/debug: [docs/API_DEBUG.md](../docs/API_DEBUG.md)

## Stack

- Python 3.12+
- FastAPI
- PostgreSQL 16
- psycopg 3
- InsightFace + ONNX Runtime
- Pytest

## Arquitetura

```text
API -> Service -> Model -> PostgreSQL
         |
         +-> regras de negócio
         +-> biometria 1:1
         +-> decisão de acesso
```

Schemas Pydantic representam os contratos HTTP.

## Executar

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Com Docker, use os comandos do README raiz.

## Documentação HTTP

- Swagger UI: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`
- OpenAPI JSON: `http://localhost:8001/openapi.json`

A Swagger está configurada com:

- descrições por domínio;
- exemplos de payload;
- duração das requisições;
- filtro de operações;
- persistência do JWT durante debug;
- códigos de erro dos endpoints críticos.

## Fluxo de acesso

```text
POST /api/v1/arduino/verificar-cartao
          |
          +-> dispositivo
          +-> local
          +-> usuário
          +-> permissão
          +-> dia/horário
          |
          v
tentativa_id PENDENTE
          |
          v
POST /api/v1/arduino/verificar-face
          |
          +-> JWT
          +-> embedding
          +-> comparação 1:1
          +-> revalidação final
          |
          v
AUTORIZADO / NEGADO / EXPIRADO
          |
          v
GET /api/v1/arduino/resultado-acesso
          |
          v
aguardar / liberar / negar
```

O ESP32 executa a decisão. Ele não define a decisão.

## Segurança

Rotas administrativas e biometria operacional exigem JWT Bearer.

As rotas físicas do ESP32 ainda possuem HMAC por dispositivo como hardening planejado. O contrato já utiliza `identificador_dispositivo` para permitir essa evolução.

## Banco

Principais tabelas:

```text
administrador
audit_logs
usuario
local
dispositivo
permissao
tentativa_acesso
historico_acesso
```

Um `local` pode possuir vários `dispositivo`.

## Testes

```bash
PYTHONPATH=. pytest -v
```

A quantidade de testes pode crescer com o projeto. Para homologação, use a saída da execução atual e não um número fixo escrito na documentação.

## Variáveis importantes

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
FACE_SIMILARITY_THRESHOLD=0.80
ACCESS_ATTEMPT_TIMEOUT_SECONDS=15
```

## Debug

Para investigar uma tentativa:

```sql
SELECT * FROM tentativa_acesso ORDER BY criado_em DESC LIMIT 10;
SELECT * FROM historico_acesso ORDER BY data_hora DESC LIMIT 10;
SELECT * FROM audit_logs ORDER BY criado_em DESC LIMIT 10;
```

Veja o roteiro completo em [docs/API_DEBUG.md](../docs/API_DEBUG.md).
