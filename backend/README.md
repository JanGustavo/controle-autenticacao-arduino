# Backend ArdLock

API FastAPI responsável por autenticação administrativa, regras de acesso físico, biometria facial 1:1, auditoria e integração com ESP32/RFID.

> Documentação detalhada: [docs/tecnico/BACKEND.md](../docs/tecnico/BACKEND.md)
> Guia de Swagger/debug: [docs/testes/API_DEBUG.md](../docs/testes/API_DEBUG.md)

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

No startup, o backend abre uma pool PostgreSQL por processo, com 2 conexões
iniciais e até 5 sob demanda. Conexões excedentes ociosas são liberadas até
voltar ao mínimo. Ajuste `DB_POOL_MIN_SIZE` e `DB_POOL_MAX_SIZE` conforme a
carga e o número de processos; cada processo possui sua própria pool. O
backend fecha a pool no shutdown, depois de encerrar a tarefa de expiração.
Scripts que utilizam os models sem iniciar o FastAPI continuam abrindo conexões
diretas. As transações dos `with get_connection()` continuam a confirmar no
sucesso e desfazer em caso de erro.

## Testes

```bash
PYTHONPATH=. pytest -v
```

A quantidade de testes pode crescer com o projeto. Para homologação, use a saída da execução atual e não um número fixo escrito na documentação.

### Benchmark da pool de conexões

O benchmark compara uma conexão PostgreSQL nova por operação com uma pool
persistente, sem alterar os dados do banco. Ele mede a consulta real do histórico
e consultas sintéticas de 1 a 10.000 linhas:

```bash
cd backend
DATABASE_URL=postgresql://postgres:senha@localhost:5432/controle_acesso \
  python -m benchmarks.connection_pool
```

Os parâmetros principais são `--rows`, `--operations`, `--concurrency`,
`--pool-min` e `--pool-max`. Exemplo mais intenso:

```bash
python -m benchmarks.connection_pool \
  --rows 1 100 1000 10000 --operations 50 --concurrency 10 \
  --pool-min 2 --pool-max 5
```

Para comparar a latência HTTP do serviço antes e depois de uma atualização,
execute o mesmo comando em ambas as versões:

```bash
python -m benchmarks.http_latency \
  --url http://127.0.0.1:8001/api/v1/health/db \
  --requests 40 --concurrency 1 4
```

A rota é somente leitura e mede uma requisição curta que consulta o banco.
Ela não substitui a medição de uma lista grande feita por `connection_pool.py`.

## Variáveis importantes

```env
DATABASE_URL=postgresql://...
DB_POOL_MIN_SIZE=2
DB_POOL_MAX_SIZE=5
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

Veja o roteiro completo em [docs/testes/API_DEBUG.md](../docs/testes/API_DEBUG.md).
