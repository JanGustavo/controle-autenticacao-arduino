SHELL := /bin/bash

BACKEND_DIR   := backend
FRONTEND_DIR  := frontend
BACKEND_PORT  := 8001
FRONTEND_PORT := 4200
DOCKER_BACKEND_PORT := 8001

.PHONY: up down build logs ps restart \
        dev dev-backend dev-frontend kill-port \
        help

# ── Docker Compose (produção / integração) ─────────────────────────────────────

up: ## Sobe todos os serviços em background (build automático na 1ª vez)
	docker compose up -d --build
	@echo ""
	@echo "✅ Serviços disponíveis:"
	@echo "   🅰️  Frontend  → http://localhost"
	@echo "   🐍 Backend   → http://localhost:$(DOCKER_BACKEND_PORT)"
	@echo "   📖 Swagger   → http://localhost:$(DOCKER_BACKEND_PORT)/docs"
	@echo ""

down: ## Para e remove os containers (mantém volumes)
	docker compose down

build: ## Força o rebuild de todas as imagens sem usar cache
	docker compose build --no-cache

logs: ## Exibe os logs em tempo real (Ctrl+C para sair)
	docker compose logs -f

ps: ## Lista o status dos containers
	docker compose ps

restart: ## Reinicia todos os containers
	docker compose restart

# ── Desenvolvimento local (sem Docker) ────────────────────────────────────────

kill-port: ## (interno) Mata o processo na porta PORT=XXXX
	@if lsof -ti :$(PORT) > /dev/null 2>&1; then \
		echo "⚠️  Porta $(PORT) ocupada — encerrando processo..."; \
		lsof -ti :$(PORT) | xargs kill -9; \
		echo "✅ Porta $(PORT) liberada."; \
	fi

dev: ## Inicia backend e frontend locais em paralelo (hot reload)
	@$(MAKE) kill-port PORT=$(BACKEND_PORT)
	@$(MAKE) kill-port PORT=$(FRONTEND_PORT)
	@echo ""
	@echo "✅ Serviços disponíveis (dev local):"
	@echo "   🅰️  Frontend  → http://localhost:$(FRONTEND_PORT)"
	@echo "   🐍 Backend   → http://localhost:$(BACKEND_PORT)"
	@echo "   📖 Swagger   → http://localhost:$(BACKEND_PORT)/docs"
	@echo ""
	@trap 'kill 0' INT; \
	$(MAKE) dev-backend & \
	$(MAKE) dev-frontend & \
	wait

dev-backend: ## Inicia o FastAPI com uvicorn (hot reload) — requer venv ativo
	@echo "🐍 Iniciando backend na porta $(BACKEND_PORT)..."
	@cd $(BACKEND_DIR) && source venv/bin/activate && uvicorn app.main:app --reload --port $(BACKEND_PORT)

dev-frontend: ## Inicia o Angular dev server (hot reload)
	@echo "🅰️  Iniciando frontend na porta $(FRONTEND_PORT)..."
	@cd $(FRONTEND_DIR) && npm start -- --port $(FRONTEND_PORT) --open

# ── Utilitários ───────────────────────────────────────────────────────────────

help: ## Lista todos os comandos disponíveis
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
