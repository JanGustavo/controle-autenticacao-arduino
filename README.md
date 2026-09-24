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

## 🔐 Autenticação e Segurança

O sistema utiliza um esquema completo de autenticação e autorização para as rotas administrativas:

1. **Hash de Senhas (bcrypt)**: Todas as senhas dos administradores são criptografadas com **bcrypt** (cost factor 12) e salt aleatório. Nenhuma senha é armazenada em texto puro.
2. **JSON Web Tokens (JWT)**: Ao autenticar em `POST /api/v1/auth/login`, o sistema gera um JWT assinado via **HS256** com tempo de expiração configurável (`JWT_EXPIRE_MINUTES`).
3. **Bearer Token**: Todas as rotas administrativas exigem o cabeçalho `Authorization: Bearer <token>`. O backend valida o token, sua expiração, sua assinatura e consulta o banco de dados para garantir que o administrador ainda existe e está ativo.
4. **Conta Principal do ArdLock**: O sistema distingue a conta administrativa principal (`principal = TRUE`). A conta principal possui proteção estrutural: **não pode ser excluída**, **não pode ser desativada** e **não pode perder a condição de principal**.
5. **Interceptor Angular**: O frontend injeta automaticamente o token JWT em cada requisição através de um `HttpInterceptor`. Caso a API responda com `401 Unauthorized`, o token é revogado e o usuário é redirecionado para a página de login.

### Variáveis de Ambiente Requeridas
- `JWT_SECRET`: Chave secreta para assinatura dos tokens JWT (usar chave longa em produção).
- `JWT_ALGORITHM`: Algoritmo HMAC (padrão: `HS256`).
- `JWT_EXPIRE_MINUTES`: Minutos para expiração do token (padrão: `60`).
- `DATABASE_URL`: URI de conexão com o PostgreSQL.

Credencial inicial de desenvolvimento definida no `init.sql`:

```text
Usuário: admin@ardlock.local
Senha: admin
```

**Não utilize essa credencial em produção.**


## 📡 API disponível

Todas as rotas abaixo utilizam o prefixo `/api/v1`.

| Recurso | Métodos | Endpoint |
|---|---|---|
| Autenticação | POST | `/auth/login` |
| Health check | GET | `/health` |
| Saúde do banco | GET | `/health/db` |
| Administradores | GET, POST | `/administradores` |
| Administrador específico | GET, PATCH, DELETE | `/administradores/{id}` |
| Logs de auditoria | GET | `/adm/audit-logs` |
| Usuários | GET, POST | `/usuarios` |
| Usuário específico | GET, PATCH, DELETE | `/usuarios/{id}` |
| Locais | GET, POST | `/locais` |
| Local específico | GET, PATCH, DELETE | `/locais/{id}` |
| Dispositivos | GET, POST | `/dispositivos` |
| Dispositivo específico | GET, PATCH, DELETE | `/dispositivos/{id}` |
| Permissões | GET, POST | `/permissoes` |
| Permissão específica | GET, PATCH, DELETE | `/permissoes/{id}` |
| Cadastro biométrico | POST | `/biometria/cadastrar/{usuario_id}` |
| Verificação RFID (ESP32) | POST | `/arduino/verificar-cartao` |
| Validação facial 1:1 (Totem, JWT) | POST | `/arduino/verificar-face` |
| Consulta da decisão (ESP32) | GET | `/arduino/resultado-acesso` |
| Cadastro de cartão RFID (JWT) | POST | `/arduino/cadastrar-cartao` |
| Histórico de acesso | GET, POST | `/historico-acesso` |
| Histórico específico | GET | `/historico-acesso/{id}` |
| WebSocket em tempo real | WS | `/ws/logs` |

A implementação de todas as rotas está separada entre **API (routers), schemas (Pydantic), models (acesso a dados com pool e transações curtas) e services (regras de negócio)**, mantendo o backend modular e desacoplado.

## 🗄️ Modelo de dados

O PostgreSQL possui as entidades normalizadas:

- `administrador` — usuários administrativos do painel e controle de conta principal (`principal = TRUE`).
- `audit_logs` — trilha de auditoria administrativa completa (ações, recurso alterado, IP e data/hora).
- `usuario` — indivíduos autorizáveis no sistema com seus UIDs de cartão RFID e embeddings faciais (`JSONB`).
- `local` — portas, salas e ambientes físicos monitorados.
- `dispositivo` — controladoras físicas (ESP32) vinculadas a um local (relação 1:N Local -> Dispositivos).
- `permissao` — regras de acesso por usuário, local, janela horária (`horario_inicio` / `horario_fim`) e dias da semana.
- `tentativa_acesso` — estado orquestrado temporário entre a aprovação do RFID e a conclusão biométrica facial (com TTL de expiração).
- `historico_acesso` — registro imutável de todas as tentativas de acesso com status, similaridade, data/hora e motivo de recusa.

## 🖥️ Frontend

O painel é desenvolvido em Angular 22 e utiliza Angular Material. Possui páginas para:
- Autenticação e gestão de administradores;
- Dashboard em tempo real com conexão WebSocket (`/ws/logs`);
- CRUD de usuários, locais, dispositivos e permissões por horário/dias;
- Totem de autoatendimento Kiosk com captura de câmera, espelhamento, síntese de voz e feedback visual de acesso.

## 🧪 Testes

No backend:

```bash
cd backend
source venv/bin/activate
PYTHONPATH=. pytest -v
```

A suíte possui 100% de aprovação (66 testes cobrindo autenticação JWT, isolamento de rotas protegidas, integridade de administradores, FaceService com InsightFace, saúde da aplicação e CRUD de usuários).

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

- [x] Estrutura modular do backend (Controller -> Service -> Model)
- [x] FastAPI + documentação OpenAPI/Swagger
- [x] PostgreSQL via Docker e migrations versionadas
- [x] Health check da aplicação e do banco de dados
- [x] Autenticação administrativa JWT (Bearer) com proteção da conta principal
- [x] Trilha de logs de auditoria administrativa (`audit_logs`)
- [x] CRUD de usuários, locais, dispositivos e permissões
- [x] Relação 1:N entre Local e Dispositivos físicos
- [x] Associação e validação estrita de cartões RFID (formato HEX)
- [x] Cadastro biométrico com embeddings InsightFace (`buffalo_l`) sem persistência da imagem crua
- [x] Orquestração de tentativa de acesso com tabela temporária e expiração automática
- [x] Medição de latência ponta a ponta (`tempo_resposta_ms`) da leitura do RFID à decisão final
- [x] Acionamento de periféricos no firmware (LEDs, Buzzer e Servo da catraca)
- [x] Broadcast de eventos em tempo real via WebSocket para o Totem
- [x] Suíte de testes automatizados com 100% de cobertura nos fluxos críticos

### Em desenvolvimento / próximos passos

- [x] Reconhecimento facial 1:1 estrito contra o titular identificado pelo RFID
- [x] Threshold biométrico operacional em 80% conforme calibração atual
- [ ] Conexão e calibração de bancada física definitiva com servo SG90 e leitor RC522 em campo

## 🎓 Contexto acadêmico

Projeto desenvolvido como parte do **Projeto Integrador de ADS**, com foco na aplicação prática de desenvolvimento web, APIs REST, banco de dados, autenticação, integração com dispositivos IoT e processamento de biometria.

## 👤 Autor

**Jan Gustavo**

- GitHub: [JanGustavo](https://github.com/JanGustavo)

## 📄 Licença

Projeto acadêmico. Licenciamento formal ainda não definido.

### Contrato do fluxo físico

O backend é a única fonte da decisão de acesso:

```text
ESP32 -> POST /arduino/verificar-cartao
          |
          +-> valida dispositivo, local, usuário, permissão, dia e horário
          |
          +-> cria tentativa_id somente se elegível

Totem -> POST /arduino/verificar-face?tentativa_id=...
          |
          +-> JWT administrativo
          +-> embedding facial
          +-> comparação 1:1
          +-> revalidação das regras
          +-> decisão final

ESP32 -> GET /arduino/resultado-acesso
          |
          +-> aguardar | liberar | negar
```

O ESP32 nunca envia `aprovado`, `similaridade` ou outro campo capaz de
definir a decisão. A autenticação HMAC por dispositivo permanece como
hardening planejado para as rotas físicas.
