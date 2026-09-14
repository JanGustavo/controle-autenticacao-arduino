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

setup: ## Instala todas as dependências do projeto (Frontend npm + Backend venv/pip)
	@echo "📦 Instalação completa de dependências para novos membros..."
	@echo "1/2 🅰️  Instalando dependências do Frontend (npm)..."
	@cd $(FRONTEND_DIR) && npm install
	@echo "2/2 🐍 Instalando dependências do Backend (Python venv)..."
	@cd $(BACKEND_DIR) && \
	if [[ ! -d venv ]]; then python3 -m venv venv; fi && \
	venv/bin/pip install --upgrade pip && \
	venv/bin/pip install -r requirements.txt
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
	@sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER ROLE postgres WITH PASSWORD 'JGustavo2106';"
	@if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'controle_acesso'" | grep -q 1; then \
		sudo -u postgres createdb controle_acesso; \
	fi
	@if ! sudo -u postgres psql -d controle_acesso -tAc "SELECT 1 FROM information_schema.tables WHERE table_name = 'administrador'" | grep -q 1; then \
		sudo -u postgres psql -v ON_ERROR_STOP=1 -d controle_acesso -f backend/init.sql; \
	fi
	@echo "✅ Banco PostgreSQL local pronto."

db-reset: ## Restaura o banco de dados local para os dados padrão iniciais
	@echo "⚠️  Apagando e recriando banco controle_acesso..."
	@sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'controle_acesso' AND pid <> pg_backend_pid();"
	@sudo -u postgres dropdb --if-exists controle_acesso
	@sudo -u postgres createdb controle_acesso
	@sudo -u postgres psql -v ON_ERROR_STOP=1 -d controle_acesso -f backend/init.sql
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
