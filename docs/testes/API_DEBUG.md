# API e Debug do ArdLock

Este guia serve como roteiro de diagnóstico rápido pela Swagger UI.

## URLs

Ambiente local padrão:

```text
Swagger UI   http://localhost:8001/docs
ReDoc        http://localhost:8001/redoc
OpenAPI      http://localhost:8001/openapi.json
Health       http://localhost:8001/api/v1/health
DB Health    http://localhost:8001/api/v1/health/db
```

## Autorização no Swagger

1. faça login em `POST /api/v1/auth/login`;
2. copie o campo `token`;
3. clique em **Authorize**;
4. informe somente o token quando a UI já indicar Bearer, ou use o formato solicitado pela versão atual da Swagger UI;
5. execute uma rota protegida.

Se uma rota protegida responder `401`, confirme assinatura, expiração, claim `sub` e status do administrador no banco.

## Cenário 1: fluxo aprovado

### A. Criar tentativa

```http
POST /api/v1/arduino/verificar-cartao
```

```json
{
  "uid_card": "A1B2C3D4",
  "identificador_dispositivo": "ESP32-ENTRADA-01"
}
```

Esperado:

- HTTP 200;
- `tentativa_id`;
- `proxima_etapa = BIOMETRIA`.

### B. Validar face

```http
POST /api/v1/arduino/verificar-face?tentativa_id=<UUID>
```

Envie uma imagem em `file`.

Esperado:

- HTTP 200;
- `aprovado`;
- `similaridade`;
- `comando`;
- `tempo_resposta_ms`.

### C. Consultar decisão física

```http
GET /api/v1/arduino/resultado-acesso
```

Parâmetros:

- `tentativa_id`
- `identificador_dispositivo`

Esperado:

```text
PENDENTE    -> aguardar
AUTORIZADO -> liberar
NEGADO      -> negar
EXPIRADO    -> negar
```

## Cenário 2: RFID recusado antes da biometria

Teste uma condição por vez:

- dispositivo inexistente;
- dispositivo inativo;
- local inativo;
- cartão inexistente;
- usuário inativo;
- sem permissão;
- dia inválido;
- horário inválido.

A biometria não deve ser necessária nesses casos.

## Cenário 3: revalidação final

Uma tentativa pode passar na etapa RFID e ainda ser negada no fechamento se alguma regra mudar antes da decisão.

Exemplos:

- administrador desativa usuário;
- local é desativado;
- dispositivo é desativado;
- permissão é removida;
- horário deixa de ser válido;
- tentativa expira.

## Códigos HTTP úteis

| Código | Interpretação |
|---|---|
| 200 | requisição processada |
| 201 | recurso criado |
| 400 | regra/entrada inválida |
| 401 | autenticação administrativa ausente ou inválida |
| 404 | entidade/tentativa não encontrada ou acesso recusado conforme contrato atual |
| 409 | conflito de estado/duplicidade |
| 422 | schema Pydantic recusou a entrada |
| 500 | erro não tratado |
| 503 | dependência, normalmente banco, indisponível |

## PostgreSQL

Para diagnosticar o fluxo, acompanhe:

```sql
SELECT * FROM tentativa_acesso ORDER BY criado_em DESC LIMIT 10;
SELECT * FROM historico_acesso ORDER BY data_hora DESC LIMIT 10;
SELECT * FROM audit_logs ORDER BY criado_em DESC LIMIT 10;
```

Uma tentativa autorizada deve possuir coerência entre:

- `tentativa_acesso.status`;
- `historico_acesso.autorizado`;
- `percentual_similaridade`;
- usuário/local/dispositivo.

## Logs

Durante desenvolvimento, rode Uvicorn com reload:

```bash
uvicorn app.main:app --reload --port 8001
```

Para debugging HTTP detalhado, combine:

- Swagger;
- DevTools do navegador;
- logs FastAPI/Uvicorn;
- consultas PostgreSQL;
- Serial Monitor do ESP32.

## Antes de mergear mudanças no fluxo crítico

```bash
cd backend
PYTHONPATH=. pytest -v

cd ../frontend
npm ci
npm run build
```

Se houver mudança em firmware, compile o sketch antes do merge.
