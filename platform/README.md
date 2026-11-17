# Portal da plataforma ArdLock

O painel global /plataforma/root pertence a este diretório. Ele usa FastAPI
(portal.py) e HTML/CSS/JavaScript (dashboard.html), servidos no container portal.
O Angular mantém o login unificado e a tela do cliente /licenca.
O Nginx encaminha /plataforma/ ao serviço ardlock-portal:8080.

## Arquivos para editar

- dashboard.html: interface do root, filtros, indicadores e gaveta.
- portal.py: autenticação e consultas reais da API.
- 001_catalogo.sql a 004_license_capacity.sql: esquema e migrações.
- compose.yaml: PostgreSQL separado e serviço portal.
- DASHBOARD.md: cálculo dos indicadores e regras de consulta.

## Subida local

Requer Docker Compose, Python 3 e OpenSSL. Na raiz, configure .env conforme
.env.example e suba a instalação operacional existente:

```sh
docker compose -p controle-acesso-arduino build backend frontend
docker compose -p controle-acesso-arduino up -d db backend frontend
./platform/up.sh
```

O portal reaproveita a imagem controle-acesso-arduino-backend:latest.
A rede externa controle-acesso-arduino_acesso-net é criada pelo Compose operacional.
Acesso via Nginx em http://localhost/plataforma/root com autenticação HTTP Basic.
No domínio HTTPS, também é possível entrar como root pela tela /login.
O cookie desse login exige HTTPS.

O bootstrap cria senhas aleatórias em instances/, que é ignorado pelo Git.
As contas existentes são preservadas. As migrações são reaplicáveis.
Para adicionar os dois clientes de apresentação:

```sh
./platform/up.sh --demo
python3 scripts/seed_demo_financeiro.py --apply
```

Para remover somente os registros financeiros de apresentação:

```sh
python3 scripts/seed_demo_financeiro.py --clean
```

As variáveis OPERATIONAL_BACKEND_URL e OPERATIONAL_INSTANCE_SLUG em compose.yaml
vinculam a consulta de licença a uma instalação operacional. O padrão aponta
para ardlock-office. Em banco novo, essa instância precisa ser registrada:
scripts/register_legacy_instance.py documenta a vinculação da instalação existente.

Após editar portal.py, reinicie o serviço. Após substituir dashboard.html,
recrie o container para remontar o arquivo:

```sh
docker compose -f platform/compose.yaml up -d --force-recreate portal
```

Nenhuma credencial ou cópia do banco de produção deve ser commitada.
