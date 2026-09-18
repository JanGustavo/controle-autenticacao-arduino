SHELL := /bin/bash

BACKEND_DIR   := backend
FRONTEND_DIR  := frontend
BACKEND_PORT  := 8001
FRONTEND_PORT := 4200
DOCKER_BACKEND_PORT := 8001

.PHONY: setup up down build logs ps restart \
	dev db-local dev-backend dev-frontend kill-port \
	db-reset help

# ── Configuração Inicial & Dependências ────────────────────────────────────────

setup: ## Instala todas as dependências do projeto e inicializa o banco de dados local
	@echo "📦 Instalação completa de dependências para novos membros..."
	@echo "1/3 🅰️  Instalando dependências do Frontend (npm)..."
	@cd $(FRONTEND_DIR) && npm install
	@echo "2/3 🐍 Instalando dependências do Backend (Python venv)..."
	@cd $(BACKEND_DIR) && \
	if [[ ! -d venv ]]; then python3 -m venv venv; fi && \
	venv/bin/pip install --upgrade pip && \
	venv/bin/pip install -r requirements.txt
	@echo "3/3 🗄️  Inicializando banco de dados local com init.sql..."
	@$(MAKE) db-local || echo "⚠️  Aviso: Não foi possível rodar db-local via sudo postgres. Se for usar Docker, o 'make up' carregará o init.sql automaticamente."
	@echo ""
	@echo "✅ Instalação concluída com sucesso! Execute 'make dev' ou 'make up' para iniciar."

# ── Docker Compose (Todos os serviços integrados) ──────────────────────────────

up: ## Sobe toda a aplicação com Docker (Frontend + Backend + PostgreSQL)
	docker compose up -d --build
	@echo ""
	@echo "✅ Aplicação iniciada via Docker:"
	@echo "   🅰️  Frontend  → http://localhost"
	@echo "   🐍 Backend   → http://localhost:$(DOCKER_BACKEND_PORT)"
	@echo "   📖 Swagger   → http://localhost:$(DOCKER_BACKEND_PORT)/docs"
	@echo "   ⚡ WebSocket → ws://localhost:$(DOCKER_BACKEND_PORT)/ws/logs"
	@echo ""

down: ## Para e remove os containers (mantém os dados salvos)
	docker compose down

build: ## Força a reconstrução de todas as imagens Docker sem cache
	docker compose build --no-cache

logs: ## Exibe os logs unificados de todos os containers em tempo real
	docker compose logs -f

ps: ## Lista os containers ativos e portas expostas
	docker compose ps

restart: ## Reinicia todos os containers
	docker compose restart

# ── Desenvolvimento Local (Hot-Reload sem Docker) ─────────────────────────────

kill-port: ## Encerra processos em portas ocupadas (PORT=XXXX)
	@if lsof -ti :$(PORT) > /dev/null 2>&1; then \
		echo "⚠️  Porta $(PORT) ocupada — encerrando processo..."; \
		lsof -ti :$(PORT) | xargs kill -9; \
		echo "✅ Porta $(PORT) liberada."; \
	fi

db-local: ## Prepara o banco de dados PostgreSQL local com schema e dados iniciais
	@echo "🗄️  Preparando PostgreSQL local..."
	@PGPASSWORD=JGustavo2106 psql -h localhost -U postgres -v ON_ERROR_STOP=1 -c "ALTER ROLE postgres WITH PASSWORD 'JGustavo2106';" >/dev/null 2>&1 || \
	 psql -h localhost -U postgres -v ON_ERROR_STOP=1 -c "ALTER ROLE postgres WITH PASSWORD 'JGustavo2106';" >/dev/null 2>&1 || true
	@if ! PGPASSWORD=JGustavo2106 psql -h localhost -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'controle_acesso'" | grep -q 1; then \
		echo "⚙️  Criando banco de dados controle_acesso..."; \
		PGPASSWORD=JGustavo2106 createdb -h localhost -U postgres controle_acesso; \
	fi
	@echo "📄 Executando init.sql..."
	@PGPASSWORD=JGustavo2106 psql -h localhost -U postgres -v ON_ERROR_STOP=1 -d controle_acesso -f backend/init.sql >/dev/null 2>&1 || true
	@for mig in backend/migrations/*.sql; do \
		if [ -f "$$mig" ]; then \
			PGPASSWORD=JGustavo2106 psql -h localhost -U postgres -v ON_ERROR_STOP=1 -d controle_acesso -f "$$mig" >/dev/null 2>&1 || true; \
		fi \
	done
	@echo "✅ Banco PostgreSQL local pronto."


db-reset: ## Restaura o banco de dados local para os dados padrão iniciais
	@echo "⚠️  Apagando e recriando banco controle_acesso..."
	@PGPASSWORD=JGustavo2106 psql -h localhost -U postgres -v ON_ERROR_STOP=1 -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'controle_acesso' AND pid <> pg_backend_pid();"
	@PGPASSWORD=JGustavo2106 dropdb -h localhost -U postgres --if-exists controle_acesso
	@PGPASSWORD=JGustavo2106 createdb -h localhost -U postgres controle_acesso
	@PGPASSWORD=JGustavo2106 psql -h localhost -U postgres -v ON_ERROR_STOP=1 -d controle_acesso -f backend/init.sql
	@for mig in backend/migrations/*.sql; do \
		if [ -f "$$mig" ]; then \
			PGPASSWORD=JGustavo2106 psql -h localhost -U postgres -v ON_ERROR_STOP=1 -d controle_acesso -f "$$mig" >/dev/null 2>&1 || true; \
		fi \
	done
	@echo "✅ Banco de dados restaurado."

dev: db-local ## Inicia ambiente completo de desenvolvimento local com Hot-Reload
	@$(MAKE) kill-port PORT=$(BACKEND_PORT)
	@$(MAKE) kill-port PORT=$(FRONTEND_PORT)
	@echo ""
	@echo "✅ Ambiente de desenvolvimento local pronto:"
	@echo "   🅰️  Frontend  → http://localhost:$(FRONTEND_PORT)"
	@echo "   🐍 Backend   → http://localhost:$(BACKEND_PORT)"
	@echo "   📖 Swagger   → http://localhost:$(BACKEND_PORT)/docs"
	@echo "   ⚡ WebSocket → ws://localhost:$(BACKEND_PORT)/ws/logs"
	@echo ""
	@trap 'kill 0' INT; \
	$(MAKE) dev-backend & \
	$(MAKE) dev-frontend & \
	wait

dev-backend: ## Inicia o servidor FastAPI local com Uvicorn (hot reload)
	@echo "🐍 Iniciando backend na porta $(BACKEND_PORT)..."
	@cd $(BACKEND_DIR) && \
	if [[ ! -x venv/bin/python ]]; then \
		echo "📦 Criando venv e instalando dependências..."; \
		python3 -m venv venv && venv/bin/pip install -r requirements.txt; \
	fi; \
	set -a && [ -f ../.env ] && . ../.env; set +a; \
	DATABASE_URL="$${DATABASE_URL:-postgresql://postgres:JGustavo2106@localhost:5432/controle_acesso}" \
	venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port $(BACKEND_PORT)

dev-frontend: ## Inicia o servidor Angular local com npm (hot reload)
	@echo "🅰️  Iniciando frontend na porta $(FRONTEND_PORT)..."
	@cd $(FRONTEND_DIR) && npm start -- --port $(FRONTEND_PORT) --open

# ── Utilitários ───────────────────────────────────────────────────────────────

help: ## Exibe o menu de ajuda com todos os comandos
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
