# Execução do ArdLock

Guia de comandos para desenvolvimento local e integração Docker, conferido com o
Makefile em 08/10/2026. Execute os comandos `make` na raiz do repositório.
Para domínio público, alternância dos bancos e diagnóstico de HTTPS/WSS,
consulte [HTTPS e WSS](HTTPS_WSS.md).

## Preparação

- Docker e Docker Compose para o ambiente integrado.
- Python 3.12+ e PostgreSQL para desenvolvimento local.
- Node.js compatível com o Angular 22 do projeto e npm para o frontend.
  O teste `test:cameras` está documentado para Node 24 com suporte a TypeScript.
- Git para controle de versão.

Copie `.env.example` para `.env` na raiz e configure os valores para o ambiente:

```bash
cp .env.example .env
```

Para instalação inicial das dependências e preparação do banco local:

```bash
make setup
```

`make setup` também prepara o banco local; revise o alvo `db-local` e sua
configuração antes de usá-lo em outra máquina. O alvo atual contém configuração
local de credenciais. O backend lê `DATABASE_URL`; `make dev-backend` carrega o
`.env` da raiz e fornece um valor local padrão quando essa variável está ausente.

## Docker

No `.env`, use `TUNNEL_ENABLED=false` para execução local. Depois:

```bash
make up
make ps
```

O `make up` inicia e aguarda o PostgreSQL, prepara o schema de um banco vazio,
aplica migrations, reconstrói as imagens com `--no-cache --pull` e recria backend
e frontend. Com `TUNNEL_ENABLED=true`, também inicia o conector Cloudflare,
exigindo o token configurado. O volume do banco é preservado.

`docker compose up -d --build` não executa toda essa sequência nem interpreta
sozinho o booleano do túnel. Não é equivalente a `make up`.

| Serviço | Endereço local |
|---|---|
| Frontend Docker | http://localhost |
| Backend | http://localhost:8001 |
| Swagger | http://localhost:8001/docs |
| ReDoc | http://localhost:8001/redoc |
| PostgreSQL | localhost:5432 |

A publicação do backend é `8001:8000`: porta 8001 no computador e 8000 no container.

```bash
make logs                       # logs de todos os serviços
docker compose logs -f backend  # logs apenas do backend
make version                    # revisão e data do frontend servido
make down                       # encerra os containers e preserva os dados
```

O alvo `make down` já inclui o profile do túnel. O antigo exemplo `make down -v`
não é um comando válido para remover volumes pelo Makefile.

## Desenvolvimento local

Após instalar as dependências, com PostgreSQL local disponível:

```bash
make dev
```

O alvo prepara o banco local e aplica migrations, encerra processos nas portas
8001 e 4200 e inicia os dois servidores com recarga automática.

Para iniciar separadamente, também na raiz:

```bash
make dev-backend
make dev-frontend
```

Esses dois alvos não preparam o banco; essa etapa pertence a `make dev`/`db-local`.

| Serviço | Endereço |
|---|---|
| Frontend Angular | http://localhost:4200 |
| Backend | http://localhost:8001 |
| Swagger | http://localhost:8001/docs |

PostgreSQL local e Docker usam a porta 5432 na configuração atual. A alternância
e a transferência de dados estão descritas em [HTTPS e WSS](HTTPS_WSS.md).

## Build e verificação

```bash
make build                      # reconstrói as imagens sem cache
make restart                    # reinicia containers existentes
make help                       # lista os alvos disponíveis
```

`make up` já chama `make build`; não é necessário executar ambos em sequência.
Reiniciar containers não incorpora alterações de código ou dependências.

Para verificar alterações de software, use a partir da raiz:

```bash
(cd backend && PYTHONPATH=. venv/bin/python -m pytest -v)
(cd frontend && npm ci && npm run build)
(cd frontend && npm run test:cameras)
```

O primeiro comando pressupõe o ambiente virtual instalado. Testes automatizados
não substituem a [homologação em bancada](../testes/ROTEIRO_HOMOLOGACAO.md).
