# Controle de Acesso — Biometria Facial + RFID

Projeto integrador de ADS — sistema de controle de acesso com Arduino/ESP32, backend FastAPI e frontend Angular.

## Estrutura

```
controle-acesso-arduino/
├── backend/          # API REST (Python + FastAPI)
├── frontend/         # Interface web (Angular)
├── firmware/         # Código do ESP32
├── docs/             # Documentação
├── docker-compose.yml
├── Makefile
└── .env.example
```

## Pré-requisitos

| Ferramenta | Versão mínima |
|---|---|
| Docker + Compose | 24+ / 2.20+ |
| Python | 3.12+ *(dev local)* |
| Node.js | 22+ *(dev local)* |

## Primeiros passos

```bash
# 1. Clone o repositório
git clone <URL_DO_REPO>
cd controle-acesso-arduino

# 2. Configure as variáveis de ambiente
cp .env.example .env
# edite o .env com suas credenciais

# 3. Suba todos os serviços
make up
```

## Acesso após o boot

| Serviço | URL |
|---|---|
| Frontend | http://localhost |
| API | http://localhost:8001 |
| Swagger UI | http://localhost:8001/docs |
| Banco (psql) | localhost:5432 |

## Comandos disponíveis

```bash
make up           # sobe tudo com Docker
make down         # para os containers
make logs         # logs em tempo real
make ps           # status dos containers
make build        # rebuild sem cache

make dev          # dev local — backend + frontend juntos (hot reload)
make dev-backend  # dev local — só FastAPI
make dev-frontend # dev local — só Angular
```

Consulte [`docs/BUILDS.md`](docs/BUILDS.md) para o guia completo de builds.

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `POSTGRES_DB` | `controle_acesso` | Nome do banco |
| `POSTGRES_USER` | `postgres` | Usuário do banco |
| `POSTGRES_PASSWORD` | `changeme` | **Altere antes de usar** |
