# Guia de Builds — Controle de Acesso

Referência rápida para subir o projeto em modo **Docker (integração)** ou **local (desenvolvimento)**.

---

## Pré-requisitos

| Ferramenta | Versão mínima | Uso |
|---|---|---|
| Docker + Compose | 24+ / 2.20+ | Build e execução dos containers |
| Python | 3.12+ | Desenvolvimento local do backend |
| Node.js | 22+ | Desenvolvimento local do frontend |

---

## 🐳 Build com Docker Compose

> Recomendado para integração e testes com banco de dados real.

### 1. Configure as variáveis de ambiente

```bash
cp .env.example .env
# edite .env com suas credenciais do banco
```

### 2. Suba todos os serviços

```bash
make up
```

Equivalente a:

```bash
docker compose up -d --build
```

**O que acontece:**
1. Imagem do `db` (Postgres 16) é puxada do Docker Hub
2. Imagem do `backend` é compilada a partir de `backend/dockerfile`
3. Imagem do `frontend` é compilada a partir de `frontend/Dockerfile`
4. Os 3 containers sobem; o backend aguarda o healthcheck do Postgres

### 3. Verifique os containers

```bash
make ps
```

Saída esperada:

```
NAME                         IMAGE      STATUS          PORTS
controle-acesso-db           postgres   Up (healthy)    0.0.0.0:5432->5432/tcp
controle-acesso-backend      backend    Up              0.0.0.0:8000->8000/tcp
controle-acesso-frontend     frontend   Up              0.0.0.0:80->80/tcp
```

### 4. Acompanhe os logs

```bash
make logs          # todos os serviços
docker compose logs -f backend   # só o backend
docker compose logs -f frontend  # só o frontend
```

### 5. Pare os serviços

```bash
make down          # para e remove containers (dados do banco permanecem)
make down -v       # idem + apaga o volume pgdata
```

### 6. Rebuild forçado (sem cache)

Use quando alterar `requirements.txt`, `package.json` ou os próprios Dockerfiles:

```bash
make build
make up
```

---

## 💻 Desenvolvimento local (hot reload)

> Recomendado para iteração rápida — backend e frontend recarregam ao salvar.

### Backend

```bash
# 1. Crie e ative o venv (apenas na primeira vez)
cd backend
python -m venv venv
source venv/bin/activate

# 2. Instale as dependências
pip install -r requirements.txt

# 3. Suba o servidor
make dev-backend
# → FastAPI disponível em http://localhost:8000
# → Swagger UI em      http://localhost:8000/docs
```

### Frontend

```bash
# 1. Instale as dependências (apenas na primeira vez)
cd frontend
npm install

# 2. Suba o dev server
make dev-frontend
# → Angular disponível em http://localhost:4200
```

### Ambos juntos

```bash
# Na raiz do projeto — sobe backend e frontend em paralelo
make dev
```

> **Nota:** em modo local o backend não conecta ao Postgres automaticamente.
> Configure a variável `DATABASE_URL` no seu shell ou em um `.env` local antes de subir.

---

## 🔗 Endpoints após o boot

| Serviço | URL |
|---|---|
| Frontend | http://localhost (Docker) / http://localhost:4200 (local) |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| Banco (psql) | `localhost:5432` — credenciais do `.env` |

---

## Resumo dos comandos

```bash
make up           # sobe tudo com Docker (build automático)
make down         # para e remove containers
make build        # rebuild sem cache
make logs         # logs em tempo real
make ps           # status dos containers
make restart      # reinicia os containers

make dev          # dev local — backend + frontend juntos
make dev-backend  # dev local — só FastAPI
make dev-frontend # dev local — só Angular

make help         # lista todos os comandos
```
