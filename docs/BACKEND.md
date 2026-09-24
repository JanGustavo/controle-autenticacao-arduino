# Backend ArdLock

O backend do ArdLock é um monólito modular em FastAPI responsável por centralizar autenticação administrativa, regras de acesso físico, biometria facial, persistência, auditoria e integração com o ESP32.

## Responsabilidades

O backend é a única camada autorizada a tomar a decisão final de acesso.

```text
RFID / ESP32
    |
    v
API FastAPI
    |
    v
Service
    |
    +--> valida regras de negócio
    +--> coordena biometria 1:1
    +--> define AUTORIZADO / NEGADO / EXPIRADO
    |
    v
Model
    |
    v
PostgreSQL
```

O ESP32 nunca deve enviar um campo capaz de decidir o acesso, como `aprovado=true`. Ele envia evidências físicas e consulta o resultado calculado pelo servidor.

## Arquitetura interna

```text
app/
├── api/        # HTTP, upload, query/path params, status codes, WebSocket
├── auth/       # JWT, login e dependências de autenticação
├── schemas/    # contratos Pydantic de entrada e saída
├── services/   # regras de negócio e coordenação
├── models/     # SQL e persistência
├── database/   # conexão PostgreSQL
└── main.py     # bootstrap FastAPI, CORS, routers e lifespan
```

Regra prática:

```text
HTTP?             -> API
Regra/decisão?    -> Service
SQL?              -> Model
Contrato de dado? -> Schema
```

## Fluxo de acesso

### 1. Elegibilidade por RFID

```http
POST /api/v1/arduino/verificar-cartao
```

Payload:

```json
{
  "uid_card": "A1B2C3D4",
  "identificador_dispositivo": "ESP32-ENTRADA-01"
}
```

Antes de qualquer processamento facial, o backend valida:

1. dispositivo cadastrado;
2. dispositivo ativo;
3. local cadastrado;
4. local ativo;
5. cartão cadastrado;
6. usuário ativo;
7. permissão do usuário para o local;
8. dia da semana;
9. janela de horário.

Somente quando tudo passa é criada uma `tentativa_id` com status `PENDENTE`.

### 2. Validação facial 1:1

```http
POST /api/v1/arduino/verificar-face?tentativa_id=<UUID>
Authorization: Bearer <JWT>
Content-Type: multipart/form-data
```

O backend:

1. carrega a tentativa;
2. confirma que ela ainda está `PENDENTE`;
3. extrai o embedding da imagem;
4. busca somente o vetor facial do usuário ligado à tentativa;
5. calcula similaridade 1:1;
6. revalida estado, permissão, dia e horário;
7. persiste a decisão;
8. grava histórico;
9. publica evento WebSocket.

O threshold operacional atual é `0.80`.

### 3. Consulta do resultado pelo ESP32

```http
GET /api/v1/arduino/resultado-acesso
    ?tentativa_id=<UUID>
    &identificador_dispositivo=ESP32-ENTRADA-01
```

Estados possíveis:

| Status | Comando | Significado |
|---|---|---|
| PENDENTE | aguardar | biometria ainda não finalizou |
| AUTORIZADO | liberar | servo/LED/buzzer podem executar sucesso |
| NEGADO | negar | acesso recusado |
| EXPIRADO | negar | janela da tentativa venceu |

## Autenticação

Rotas administrativas usam JWT Bearer.

```http
Authorization: Bearer <token>
```

O backend valida:

- esquema Bearer;
- assinatura;
- expiração;
- claim `sub`;
- existência do administrador;
- administrador ativo.

As rotas físicas `verificar-cartao` e `resultado-acesso` ainda não usam HMAC por dispositivo. O contrato já está preparado para esse hardening.

## Persistência

Entidades principais:

- `administrador`
- `audit_logs`
- `usuario`
- `local`
- `dispositivo`
- `permissao`
- `tentativa_acesso`
- `historico_acesso`

Relacionamento importante:

```text
Local 1 ---- N Dispositivo
Usuario N -- N Local, via Permissao
Tentativa -> Usuario + Local + Dispositivo
Historico -> Usuario + Local + Dispositivo
```

## Auditoria

Operações administrativas relevantes gravam:

- administrador;
- ação;
- recurso;
- identificador do recurso;
- descrição;
- IP;
- user-agent;
- data/hora.

Não confundir `audit_logs` com `historico_acesso`:

- `audit_logs`: ações administrativas;
- `historico_acesso`: tentativas físicas de entrada.

## Background jobs

O lifespan da aplicação inicia o loop periódico de expiração de tentativas pendentes.

Tentativas que ultrapassam o TTL configurado deixam de ser aceitas e são registradas como expiradas.

Variável:

```env
ACCESS_ATTEMPT_TIMEOUT_SECONDS=15
```

## Debug

Com backend local:

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8001
```

Recursos:

- Swagger: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`
- OpenAPI JSON: `http://localhost:8001/openapi.json`
- Health: `http://localhost:8001/api/v1/health`
- Banco: `http://localhost:8001/api/v1/health/db`

Para testes:

```bash
PYTHONPATH=. pytest -v
```

Não considere a suíte homologada apenas pela existência dos testes. Sempre registre a saída da execução antes de mergear.
