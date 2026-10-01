SHELL := /bin/bash

BACKEND_DIR   := backend
FRONTEND_DIR  := frontend
BACKEND_PORT  := 8001
FRONTEND_PORT := 4200
DOCKER_BACKEND_PORT := 8001

.PHONY: setup up down build logs ps restart \
	dev db-local migrate-local migrate-docker dev-backend dev-frontend kill-port \
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

up: ## Sobe Docker; TUNNEL_ENABLED=true adiciona HTTPS/WSS via Cloudflare Tunnel
	@echo "🗄️  Subindo PostgreSQL para aplicar migrations..."
	docker compose up -d db
	@until docker compose exec -T db pg_isready -U postgres -d controle_acesso >/dev/null 2>&1; do sleep 1; done
	@$(MAKE) migrate-docker
	@set -a; [ -f .env ] && source .env; set +a; \
	DOMAIN="$${ARDLOCK_DOMAIN:-ardlock.jangustavo.me}"; \
	if [[ "$${TUNNEL_ENABLED:-false}" == "true" ]]; then \
		if [[ -z "$${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then \
			echo "❌ TUNNEL_ENABLED=true, mas CLOUDFLARE_TUNNEL_TOKEN está vazio."; \
			exit 1; \
		fi; \
		export FRONTEND_URL="https://$$DOMAIN"; \
		echo "🔐 Modo tunnel habilitado para https://$$DOMAIN"; \
		docker compose --profile tunnel up -d --build; \
	else \
		export FRONTEND_URL="$${FRONTEND_URL:-http://localhost:4200}"; \
		echo "🧪 Modo local habilitado (HTTP/WS)."; \
		docker compose up -d --build; \
	fi
	@echo ""
	@set -a; [ -f .env ] && source .env; set +a; \
	DOMAIN="$${ARDLOCK_DOMAIN:-ardlock.jangustavo.me}"; \
	echo "✅ Aplicação iniciada via Docker:"; \
	echo "   🅰️  Frontend local → http://localhost"; \
	echo "   🐍 Backend debug   → http://localhost:$(DOCKER_BACKEND_PORT)"; \
	echo "   📖 Swagger debug   → http://localhost:$(DOCKER_BACKEND_PORT)/docs"; \
	if [[ "$${TUNNEL_ENABLED:-false}" == "true" ]]; then \
		echo "   🔒 HTTPS público   → https://$$DOMAIN"; \
		echo "   ⚡ WSS público     → wss://$$DOMAIN/ws/logs"; \
	else \
		echo "   ⚡ WebSocket local → ws://localhost:$(DOCKER_BACKEND_PORT)/ws/logs"; \
	fi
	@echo ""

down: ## Para e remove os containers (mantém os dados salvos)
	docker compose --profile tunnel down

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

db-local: ## Prepara o banco de dados PostgreSQL local com schema e migrations
	@echo "🗄️  Preparando PostgreSQL local..."
	@PGPASSWORD=JGustavo2106 psql -h localhost -U postgres -v ON_ERROR_STOP=1 -c "ALTER ROLE postgres WITH PASSWORD 'JGustavo2106';" >/dev/null 2>&1 || \
	 psql -h localhost -U postgres -v ON_ERROR_STOP=1 -c "ALTER ROLE postgres WITH PASSWORD 'JGustavo2106';" >/dev/null 2>&1 || true
	@if ! PGPASSWORD=JGustavo2106 psql -h localhost -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'controle_acesso'" | grep -q 1; then \
		echo "⚙️  Criando banco de dados controle_acesso..."; \
		PGPASSWORD=JGustavo2106 createdb -h localhost -U postgres controle_acesso; \
		echo "📄 Inicializando schema base..."; \
		PGPASSWORD=JGustavo2106 psql -h localhost -U postgres -v ON_ERROR_STOP=1 -d controle_acesso -f backend/init.sql >/dev/null; \
	fi
	@$(MAKE) migrate-local
	@echo "✅ Banco PostgreSQL local pronto."

migrate-local: ## Executa migrations SQL no PostgreSQL local
	@echo "🔄 Executando migrations locais..."
	@set -e; for mig in backend/migrations/*.sql; do \
		if [ -f "$$mig" ]; then \
			echo "   → $$mig"; \
			PGPASSWORD=JGustavo2106 psql -h localhost -U postgres -v ON_ERROR_STOP=1 -d controle_acesso -f "$$mig" >/dev/null; \
		fi; \
	done
	@echo "✅ Migrations locais aplicadas."

migrate-docker: ## Executa migrations SQL no PostgreSQL do Docker
	@set -e; \
	tables=$$(docker compose exec -T db psql -U "$${POSTGRES_USER:-postgres}" -d "$${POSTGRES_DB:-controle_acesso}" -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND table_type = 'BASE TABLE';"); \
	if [ "$$tables" = "0" ]; then \
		echo "📄 Banco vazio: inicializando schema base antes das migrations..."; \
		docker compose exec -T db psql -U "$${POSTGRES_USER:-postgres}" -d "$${POSTGRES_DB:-controle_acesso}" -v ON_ERROR_STOP=1 --single-transaction < backend/init.sql >/dev/null; \
	fi
	@echo "🔄 Executando migrations no PostgreSQL Docker..."
	@set -e; for mig in backend/migrations/*.sql; do \
		if [ -f "$$mig" ]; then \
			echo "   → $$mig"; \
			docker compose exec -T db psql -U "$${POSTGRES_USER:-postgres}" -d "$${POSTGRES_DB:-controle_acesso}" -v ON_ERROR_STOP=1 < "$$mig" >/dev/null; \
		fi; \
	done
	@echo "✅ Migrations Docker aplicadas."

db-reset: ## Restaura o banco de dados local para os dados padrão iniciais
	@echo "⚠️  Apagando e recriando banco controle_acesso..."
	@PGPASSWORD=JGustavo2106 psql -h localhost -U postgres -v ON_ERROR_STOP=1 -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'controle_acesso' AND pid <> pg_backend_pid();"
	@PGPASSWORD=JGustavo2106 dropdb -h localhost -U postgres --if-exists controle_acesso
	@PGPASSWORD=JGustavo2106 createdb -h localhost -U postgres controle_acesso
	@PGPASSWORD=JGustavo2106 psql -h localhost -U postgres -v ON_ERROR_STOP=1 -d controle_acesso -f backend/init.sql
	@$(MAKE) migrate-local
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
