# Backend — ArdLock

API REST responsável pela camada de negócio do sistema de controle de acesso. O backend é um **monólito modular** construído com Python e FastAPI, com PostgreSQL como persistência.

Não há microserviços ou broker de eventos no estado atual. Os módulos se comunicam internamente e a interface/hardware acessam a aplicação por HTTP/REST.

## Stack

- Python 3.12+
- FastAPI 0.115
- Uvicorn
- PostgreSQL 16
- psycopg 3
- Pytest + HTTPX

As dependências estão fixadas em `requirements.txt`. fileciteturn11file0L2-L2

## Arquitetura

```text
backend/
├── app/
│   ├── api/           # Controllers / rotas HTTP
│   ├── auth/          # Autenticação administrativa
│   ├── database/      # Conexão com PostgreSQL
│   ├── schemas/       # Contratos de entrada e saída
│   └── services/      # Regras e operações de negócio
├── tests/             # Testes automatizados
├── init.sql           # Schema e dados iniciais
├── requirements.txt
├── dockerfile
└── README.md
```

A aplicação registra os routers de autenticação, usuários, permissões, locais, histórico e health checks sob `/api/v1`. fileciteturn12file0L2-L2

## Executar localmente

### 1. Criar ambiente virtual

```bash
cd backend
python -m venv venv
source venv/bin/activate
```

No Windows:

```powershell
venv\Scripts\activate
```

### 2. Instalar dependências

```bash
pip install -r requirements.txt
```

### 3. Iniciar a API

```bash
uvicorn app.main:app --reload
```

Por padrão, o Uvicorn disponibiliza a API em:

```text
http://localhost:8000
```

> Para desenvolvimento com Docker Compose, o container expõe a porta `8000` internamente e a porta `8001` no host.

## Banco de dados

O projeto utiliza PostgreSQL 16. O arquivo `init.sql` cria e popula as tabelas necessárias para o ambiente de desenvolvimento:

```text
administrador
usuario
local
permissao
historico_acesso
```

Também existem índices para consultas do histórico por usuário/data e local/data. fileciteturn21file0L2-L2

### Variável de conexão

```text
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
```

No Docker Compose, a conexão é montada automaticamente usando as variáveis do PostgreSQL e o hostname `db`. fileciteturn9file0L2-L2

## Autenticação

Endpoint:

```http
POST /api/v1/auth/login
```

Exemplo de requisição:

```json
{
  "usuario": "admin@ardlock.local",
  "senha": "admin."
}
```

A autenticação consulta administradores ativos pelo e-mail e valida a senha usando **PBKDF2-HMAC-SHA256**, com salt e número de iterações armazenados no hash. A comparação do digest usa `hmac.compare_digest`. fileciteturn8file0L2-L2

Exemplo de resposta:

```json
{
  "sucesso": true,
  "token": "...",
  "usuario": "admin@ardlock.local"
}
```

### ⚠️ Estado atual da autenticação

O token retornado atualmente é gerado com `secrets.token_urlsafe(32)`. Portanto, **não é um JWT** e ainda não existe uma camada completa de autorização das rotas administrativas no backend. fileciteturn8file0L2-L2

Isso está documentado como ponto de evolução antes de um eventual uso em produção.

## Endpoints

Base URL:

```text
/api/v1
```

### Health

```http
GET /api/v1/health
GET /api/v1/health/db
```

### Autenticação

```http
POST /api/v1/auth/login
```

### Administrador

```http
GET /api/v1/adm/adm-page
```

### Usuários

```http
GET    /api/v1/usuarios
GET    /api/v1/usuarios/{usuario_id}
POST   /api/v1/usuarios
PATCH  /api/v1/usuarios/{usuario_id}
DELETE /api/v1/usuarios/{usuario_id}
```

A implementação separa as rotas da camada de serviço. fileciteturn13file0L2-L2

### Locais

```http
GET    /api/v1/locais
GET    /api/v1/locais/{local_id}
POST   /api/v1/locais
PATCH  /api/v1/locais/{local_id}
DELETE /api/v1/locais/{local_id}
```

fileciteturn17file0L2-L2

### Permissões

```http
GET    /api/v1/permissoes
GET    /api/v1/permissoes/{permissao_id}
POST   /api/v1/permissoes
PATCH  /api/v1/permissoes/{permissao_id}
DELETE /api/v1/permissoes/{permissao_id}
```

fileciteturn15file0L2-L2

### Histórico de acesso

```http
GET  /api/v1/historico-acesso
GET  /api/v1/historico-acesso/{historico_id}
POST /api/v1/historico-acesso
```

fileciteturn16file0L2-L2

## Swagger / OpenAPI

Com a API em execução:

```text
http://localhost:8000/docs
```

No Docker Compose:

```text
http://localhost:8001/docs
```

O FastAPI também disponibiliza o documento OpenAPI em `/openapi.json`.

## Testes

```bash
pytest
```

Os testes atuais incluem autenticação, health check e operações de usuários.

## Docker

A imagem do backend é construída pelo `docker-compose.yml` e executa a API no container. O código de `backend/app` é montado como volume para facilitar o desenvolvimento com hot reload. fileciteturn9file0L2-L2

Para subir somente a infraestrutura completa:

```bash
cd ..
docker compose up -d --build
```

## Próximas evoluções

- [ ] Integração RFID/RC522 com ESP32
- [ ] Identificação e autenticação do dispositivo
- [ ] Captura de imagem
- [ ] Geração de embeddings faciais
- [ ] Comparação biométrica 1:1
- [ ] Regra de autorização por horário, dia, usuário e local
- [ ] Comunicação de autorização/negação com ESP32
- [ ] JWT ou mecanismo de sessão equivalente
- [ ] Middleware de autorização das rotas protegidas
- [ ] Testes de integração
- [ ] Documentação do protocolo hardware ↔ API

## Status

O backend já possui a base funcional para **autenticação administrativa, gerenciamento de usuários, locais, permissões e histórico**, mas o fluxo completo de autenticação física com RFID + biometria + ESP32 ainda está em desenvolvimento.
