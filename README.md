# ArdLock — Controle de Acesso

Projeto integrador de Análise e Desenvolvimento de Sistemas (ADS) para gerenciamento de acesso físico, combinando **RFID**, **biometria facial**, **ESP32** e uma aplicação web administrativa.

O projeto está organizado como uma aplicação web com **frontend Angular**, **backend FastAPI** e **PostgreSQL**. A camada de domínio já contempla usuários, locais, permissões e histórico de acessos. A integração física com ESP32/RFID e a validação biométrica ainda fazem parte da evolução do projeto.

## 🧩 Arquitetura

```text
┌──────────────────────┐
│      ESP32 / RFID    │
│  Leitura do cartão   │
└──────────┬───────────┘
           │ HTTP/REST
           ▼
┌──────────────────────┐
│   Backend FastAPI    │
│                      │
│ Auth                 │
│ Usuários             │
│ Locais               │
│ Permissões           │
│ Histórico            │
└──────────┬───────────┘
           │ SQL
           ▼
┌──────────────────────┐
│     PostgreSQL 16    │
└──────────────────────┘
           ▲
           │ HTTP/REST
┌──────────┴───────────┐
│   Frontend Angular   │
│ Painel administrativo│
└──────────────────────┘
```

### Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | Angular 22 + Angular Material + TypeScript |
| Backend | Python 3.12+ + FastAPI + Uvicorn |
| Banco | PostgreSQL 16 |
| Driver DB | psycopg 3 |
| Testes | Pytest + HTTPX |
| Infraestrutura | Docker + Docker Compose |
| Hardware planejado | ESP32 + RFID/RC522 + câmera |

## 📁 Estrutura do projeto

```text
controle-autenticacao-arduino/
├── backend/
│   ├── app/
│   │   ├── api/          # Rotas HTTP
│   │   ├── auth/         # Autenticação administrativa
│   │   ├── database/     # Conexão com PostgreSQL
│   │   ├── schemas/      # Modelos de entrada/saída
│   │   └── services/     # Regras e operações de negócio
│   ├── tests/            # Testes automatizados
│   ├── init.sql          # Schema + dados iniciais
│   ├── requirements.txt
│   ├── dockerfile
│   └── README.md
├── frontend/
│   ├── src/app/
│   │   ├── components/   # Componentes compartilhados
│   │   ├── guards/       # Proteção das rotas
│   │   ├── models/       # Modelos da aplicação
│   │   ├── pages/        # Telas do sistema
│   │   └── services/     # Comunicação com a API
│   ├── Dockerfile
│   └── README.md
├── docs/                 # Documentação complementar
├── docker-compose.yml
├── Makefile
└── .env.example
```

## 🚀 Executando com Docker

### Pré-requisitos

- Docker 24+
- Docker Compose 2.20+
- Git

### 1. Clone o projeto

```bash
git clone https://github.com/JanGustavo/controle-autenticacao-arduino.git
cd controle-autenticacao-arduino
```

### 2. Configure o ambiente

```bash
cp .env.example .env
```

Revise as credenciais do PostgreSQL antes de utilizar o projeto fora de um ambiente local.

### 3. Suba os serviços

```bash
make up
```

Ou diretamente:

```bash
docker compose up -d --build
```

### 4. Acesse

| Serviço | Endereço |
|---|---|
| Painel Angular | http://localhost |
| API | http://localhost:8001 |
| Swagger UI | http://localhost:8001/docs |
| OpenAPI JSON | http://localhost:8001/openapi.json |
| PostgreSQL | localhost:5432 |

O Docker Compose publica o backend na porta `8001` do host, embora o FastAPI escute na porta `8000` dentro do container.

## 🔐 Autenticação

O painel possui login administrativo em:

```text
POST /api/v1/auth/login
```

As credenciais são verificadas contra a tabela `administrador`. As senhas são armazenadas utilizando **PBKDF2-HMAC-SHA256 com salt**, e a comparação do digest utiliza comparação em tempo constante. Após o login, a API retorna um token aleatório para a sessão do frontend. fileciteturn8file0L2-L2

> **Estado atual:** o token retornado ainda não é um JWT e a autorização das rotas da API precisa ser fortalecida antes de considerar o sistema pronto para produção.

Credencial inicial de desenvolvimento definida no `init.sql`:

```text
Usuário: admin@ardlock.local
Senha: admin.
```

**Não utilize essa credencial em produção.**

## 📡 API disponível

Todas as rotas abaixo utilizam o prefixo `/api/v1`.

| Recurso | Métodos | Endpoint |
|---|---|---|
| Autenticação | POST | `/auth/login` |
| Health check | GET | `/health` |
| Saúde do banco | GET | `/health/db` |
| Painel administrativo | GET | `/adm/adm-page` |
| Usuários | GET, POST | `/usuarios` |
| Usuário específico | GET, PATCH, DELETE | `/usuarios/{id}` |
| Locais | GET, POST | `/locais` |
| Local específico | GET, PATCH, DELETE | `/locais/{id}` |
| Permissões | GET, POST | `/permissoes` |
| Permissão específica | GET, PATCH, DELETE | `/permissoes/{id}` |
| Histórico de acesso | GET, POST | `/historico-acesso` |
| Histórico específico | GET | `/historico-acesso/{id}` |

A implementação atual das rotas de usuários, locais, permissões e histórico já está separada entre **API, schemas e services**, mantendo o backend como um monólito modular. fileciteturn13file0L2-L2 fileciteturn15file0L2-L2 fileciteturn16file0L2-L2 fileciteturn17file0L2-L2

## 🗄️ Modelo de dados

O PostgreSQL possui as entidades principais:

- `administrador` — usuários administrativos do painel.
- `usuario` — pessoas que podem receber acesso.
- `local` — portas/ambientes associados a dispositivos.
- `permissao` — regras de acesso por usuário, local, horário e dias da semana.
- `historico_acesso` — registro das tentativas de acesso.

O histórico possui índices compostos por usuário/data e local/data para acelerar consultas cronológicas. Os vetores faciais são representados como `JSONB` no MVP, permitindo comparação 1:1. O uso de `pgvector` pode ser considerado posteriormente para buscas por similaridade em escala. fileciteturn21file0L2-L2

## 🖥️ Frontend

O painel é desenvolvido em Angular 22 e utiliza Angular Material. Atualmente possui páginas para login, painel administrativo, dashboard, usuários, permissões, locais, entidades e cadastro. Rotas administrativas são protegidas pelo `authGuard`. fileciteturn18file0L2-L2

A comunicação com a API é centralizada em `ApiService`, utilizando HTTP e a base `http://localhost:8001/api/v1` no ambiente local. fileciteturn20file0L2-L2

## 🧪 Testes

No backend:

```bash
cd backend
pytest
```

Os testes atuais cobrem autenticação, health check e operações relacionadas a usuários.

## 🛠️ Comandos Make

```bash
make up           # sobe os containers
make down         # para os containers
make logs         # acompanha os logs
make ps           # mostra o status
make build        # recria as imagens sem cache
make dev          # desenvolvimento local
make dev-backend  # somente backend
make dev-frontend # somente frontend
```

## 📌 Estado do projeto

### Implementado

- [x] Estrutura modular do backend
- [x] FastAPI + documentação OpenAPI/Swagger
- [x] PostgreSQL via Docker
- [x] Health check da aplicação e do banco
- [x] Autenticação administrativa
- [x] CRUD de usuários
- [x] CRUD de locais
- [x] CRUD de permissões
- [x] Consulta e registro do histórico de acesso
- [x] Painel Angular
- [x] Proteção de rotas no frontend
- [x] Testes automatizados básicos
- [x] Ambiente Docker Compose

### Em desenvolvimento / próximos passos

- [ ] Integrar leitura RFID pelo ESP32/RC522
- [ ] Implementar identificação do dispositivo por `identificador_dispositivo`
- [ ] Capturar imagem da câmera
- [ ] Gerar embeddings faciais
- [ ] Comparar biometria facial 1:1
- [ ] Implementar regra completa de autorização no fluxo físico
- [ ] Enviar resposta de acesso autorizado/negado ao ESP32
- [ ] Persistir token de sessão de forma mais robusta
- [ ] Implementar autorização no backend para rotas administrativas
- [ ] Substituir o token temporário por JWT ou mecanismo equivalente
- [ ] Adicionar documentação de integração hardware ↔ API
- [ ] Revisar CORS e configurações para produção

## 🎓 Contexto acadêmico

Projeto desenvolvido como parte do **Projeto Integrador de ADS**, com foco na aplicação prática de desenvolvimento web, APIs REST, banco de dados, autenticação, integração com dispositivos IoT e processamento de biometria.

## 👤 Autor

**Jan Gustavo**

- GitHub: [JanGustavo](https://github.com/JanGustavo)

## 📄 Licença

Projeto acadêmico. Licenciamento formal ainda não definido.
