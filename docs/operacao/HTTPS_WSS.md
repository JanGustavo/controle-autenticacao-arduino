# ArdLock: ambiente local, Docker e domínio público

Este guia descreve o funcionamento atual de `make dev`, `make up` e da publicação
em `https://ardlock.jangustavo.me` por Cloudflare Tunnel. A registradora continua
sendo a Namecheap; o DNS do domínio é gerenciado pela Cloudflare.

## Modos de execução

| Modo | Comando | Interface | API | WebSocket | Banco |
|---|---|---|---|---|---|
| Desenvolvimento | `make dev` | `http://localhost:4200` | `http://localhost:8001/api/v1` | `ws://localhost:8001/ws/logs` | PostgreSQL local |
| Docker local | `make up`, `TUNNEL_ENABLED=false` | `http://localhost` ou `http://localhost:4200` | `http://localhost:8001/api/v1` | `ws://localhost:8001/ws/logs` | Volume Docker `pgdata` |
| Docker público | `make up`, `TUNNEL_ENABLED=true` | `https://ardlock.jangustavo.me` | `https://ardlock.jangustavo.me/api/v1` | `wss://ardlock.jangustavo.me/ws/logs` | Mesmo volume Docker |

O `.env` controla o túnel iniciado pelo **Makefile**. `make dev` não inicia o
`cloudflared`; `docker compose up` sozinho não interpreta `TUNNEL_ENABLED`.
`make setup` instala as dependências para desenvolvimento local.

O `make up` inicia o banco, aguarda disponibilidade, executa `migrate-docker` e
reconstrói backend e frontend com `--no-cache --pull`, depois recria os containers
da aplicação com `--force-recreate --no-deps`. O banco não é recriado por essa etapa.
O processo informa o diretório, a branch e o commit usados. O build usa os arquivos
do checkout atual: reconstruir uma branch antiga não incorpora alterações de outras
branches; atualize a branch antes de rodar `make up`. Se o banco estiver sem tabelas de aplicação,
`migrate-docker` aplica `backend/init.sql` em uma transação antes das migrations.
Um banco já preenchido não é reinicializado. Isso também atende volumes existentes
que estejam com o banco vazio: o entrypoint do PostgreSQL só inicializa um diretório
de dados novo, e pode pular o `init.sql` quando o volume já existe.

## Como o domínio chega à aplicação

```text
Navegador / celular / Postman
          |
          | HTTPS ou WSS: ardlock.jangustavo.me
          v
Cloudflare DNS + borda TLS
          |
          | conexão de túnel criptografada, iniciada pelo notebook
          v
cloudflared (container, profile tunnel)
          |
          | http://frontend:80, rede Docker acesso-net
          v
Nginx (container frontend)
          |-- /       -> arquivos Angular
          |-- /api/   -> http://backend:8000/api/...
          `-- /ws/    -> http://backend:8000/ws/... (Upgrade WebSocket)
                               |
                               v
                         FastAPI -> PostgreSQL db:5432
```

A Cloudflare fornece o certificado HTTPS público. O túnel mantém uma conexão de
saída com a Cloudflare; não exige IPv4 público nem abertura de portas no roteador.
O HTTP entre o conector e o Nginx fica na rede Docker. Caddy não faz parte desse
fluxo. O Angular usa a API no mesmo domínio fora de localhost e escolhe `wss:`
quando a página usa `https:`. O Nginx encaminha o handshake WebSocket para o backend.

O notebook precisa estar ligado, com Docker e túnel rodando e acesso à Internet.
Ao mudar de casa para a faculdade ou hotspot, a rota permanece igual. A rede precisa
permitir as conexões de saída do `cloudflared`; o serviço não fica disponível quando
o notebook está desligado.

## Configuração: Namecheap e Cloudflare

### 1. Adicionar o domínio

1. Na Cloudflare, adicione **jangustavo.me** e escolha o plano Free.
2. Importe e confira os registros DNS existentes. Preserve registros usados por
   outros serviços, especialmente MX e TXT de e-mail/verificação.
3. Copie os dois nameservers atribuídos à zona pela Cloudflare.
4. Na Namecheap, abra **Domain List → Manage → Domain → Nameservers → Custom DNS**.
5. Substitua os nameservers antigos pelos dois atribuídos e salve no botão de confirmação.
   Não use a seção **Advanced DNS → Personal DNS Server**.
6. Na Cloudflare, confirme a troca e aguarde o status **Active**.

Os nameservers atribuídos a esta zona são `mallory.ns.cloudflare.com` e
`patryk.ns.cloudflare.com`. Para outro domínio ou conta, use os nomes fornecidos
pelo próprio painel. O status Active da Namecheap refere-se ao registro do domínio;
a ativação da zona DNS precisa ser confirmada separadamente na Cloudflare.
Se houver DNSSEC antigo configurado, siga as instruções de migração da Cloudflare
para evitar uma delegação com registros DS incompatíveis.

A propagação e os caches podem levar até 24–48 horas. Depois da troca, alterações
nos registros DNS são feitas na Cloudflare. Não crie um registro A para o IP privado
do notebook: a publicação usa a rota do túnel.

### 2. Criar e conectar o túnel

1. Na conta Cloudflare, abra **Networking → Tunnels → Create Tunnel**.
2. Crie um túnel remoto do tipo **Cloudflared** chamado **ardlock**.
3. Em **Setup Environment**, escolha **Docker**.
4. Do comando de instalação, copie somente o valor depois de `--token` para o `.env`.

```env
TUNNEL_ENABLED=true
ARDLOCK_DOMAIN=ardlock.jangustavo.me
CLOUDFLARE_TUNNEL_TOKEN=cole_o_token_do_tunel_aqui
```

Preserve as demais configurações do `.env`. Execute na raiz do projeto:

```bash
make up
docker compose --profile tunnel ps
docker compose logs --tail=50 cloudflared
```

Não é necessário executar um `docker run` separado. O Compose coloca o conector na
mesma rede do frontend, necessária para resolver o nome `frontend`. O token vazio
faz `make up` falhar antes de iniciar o profile do túnel. O estado **Healthy** no
painel e linhas **Registered tunnel connection** nos logs confirmam a conexão;
eles não confirmam, sozinhos, a configuração do hostname público.

### 3. Publicar a aplicação

No túnel **ardlock**, abra **Routes → Add route → Published application**
(**Rotas → Adicionar rota → Aplicação publicada**):

| Campo | Valor |
|---|---|
| Subdomínio | `ardlock` |
| Domínio | `jangustavo.me` |
| Caminho | Vazio |
| URL do serviço | `http://frontend:80` |
| Configurações adicionais | Padrões |

Se o formulário separar protocolo e endereço, escolha **HTTP** e informe
`frontend:80`. Salve. A publicação cria o registro DNS associado ao túnel; confira
em DNS que `ardlock` aponta para o túnel, normalmente por CNAME com destino
`<UUID>.cfargotunnel.com`. Não use `localhost` como serviço: dentro do conector,
`localhost` aponta para o próprio container do `cloudflared`.

## Alternar os ambientes e preservar os dados

O PostgreSQL local e o container publicam a porta **5432**. Na configuração atual,
eles não podem ocupar essa porta ao mesmo tempo. Para usar o Docker após `make dev`:

```bash
# Encerre make dev com Ctrl+C antes de mudar o ambiente.
sudo systemctl stop postgresql
make up
```

Para voltar ao desenvolvimento local:

```bash
make down
sudo systemctl start postgresql
make dev
```

Parar o serviço local não apaga seu banco. `make down` preserva o volume Docker.
Não use `docker compose down -v` para alternar os ambientes: esse comando remove
os volumes e seus dados.

Para desativar a publicação, coloque `TUNNEL_ENABLED=false`, execute `make down`
e depois `make up`. O `down` inclui o profile tunnel e remove também o conector.
Mudar apenas o booleano e executar `up` pode deixar um conector antigo rodando.

### Copiar os dados locais para o Docker

Os bancos são independentes. O túnel publica o banco usado pelo backend Docker;
ele não sincroniza dados com o banco do `make dev`.

A transferência deve exportar **schema, dados e sequências** com `pg_dump` em
formato custom e restaurar no Docker com `pg_restore`. Procedimento:

1. Pause a aplicação e faça backup do banco Docker antes de substituí-lo.
2. Pare o banco Docker para liberar a porta e inicie o PostgreSQL local.
3. Exporte `controle_acesso` com `pg_dump --format=custom --no-owner --no-acl`,
   usando as credenciais locais. O dump é uma leitura e não altera a origem.
4. Pare o PostgreSQL local, inicie o banco Docker e aguarde disponibilidade.
5. Restaure o dump no destino com `pg_restore --clean --if-exists --no-owner
   --no-acl --single-transaction`, com a aplicação ainda pausada.
6. Compare os registros e sequências e reinicie backend, frontend e túnel.

Essa operação sobrescreve o destino Docker e mantém a origem local. Não restaure
sobre um banco local por engano. Arquivos hospedados fora do banco, como fotos
externas, não são copiados pelo dump; seus endereços são preservados. Alterações
posteriores em qualquer um dos bancos exigem uma nova transferência para sincronizar.

## Testar a interface, API e WSS

Abra `http://localhost` para Docker local ou `https://ardlock.jangustavo.me` para
acesso público. Use uma conta presente no banco Docker. Após copiar a origem local,
as mesmas credenciais ficam disponíveis no Docker. Confira cadastros, permissões,
histórico e auditoria. Um celular em dados móveis permite testar o acesso externo.

```bash
curl -i http://localhost:8001/api/v1/health
curl -i http://localhost/api/v1/health
curl -i https://ardlock.jangustavo.me/api/v1/health
```

Os três devem retornar HTTP **200** e `{"status":"ok"}`. No Postman, use a URL
HTTPS para a API; faça login em `/api/v1/auth/login` e use o JWT nas rotas protegidas.
Para WebSocket, abra uma requisição WebSocket com:

```text
wss://ardlock.jangustavo.me/ws/logs
```

O handshake bem-sucedido retorna **101 Switching Protocols**. Para conferir pela
interface, abra uma tela que usa os eventos, como Dashboard ou Validar Acesso,
e inspecione **DevTools → Network → WS**. Dispare uma leitura RFID/tentativa de
acesso e confira as mensagens e a atualização da interface.

### Validação realizada em 01/10/2026

- HTTP local, API direta e API pelo Nginx: **200**, `{"status":"ok"}`.
- HTTPS público pelo túnel: **200**, `{"status":"ok"}`.
- WSS público em `/ws/logs`: handshake **101 Switching Protocols**.
- Cópia local → Docker: dados e sequências comparados por exportação e confirmados iguais.

O handshake comprova a conexão WSS; o fluxo completo de eventos com hardware ainda
precisa ser exercitado. Não confunda conexão estabelecida com validação de todos
os eventos de RFID/biometria.

## Diagnóstico

| Sintoma | Verificação/ação |
|---|---|
| Docker daemon indisponível | `sudo systemctl start docker`; confirme com `docker info` |
| Porta 5432 ocupada | `sudo ss -ltnp 'sport = :5432'`; pare o PostgreSQL local antes de usar Docker |
| Banco vazio/migration sem tabela | Atualize o projeto e use `make up`/`make migrate-docker`, que inicializam o schema vazio |
| Túnel Healthy, mas Routes = 0 | Adicione a aplicação publicada com serviço `http://frontend:80` |
| `Could not resolve host` / `ERR_NAME_NOT_RESOLVED` | Confira delegação, status Active, registro `ardlock` e caches DNS |
| Erro 502 na URL pública | Confira frontend/backend, rede Docker, URL do serviço e logs do Nginx/conector |
| WSS não recebe mensagens | Confira handshake 101 e gere um evento; conexão sozinha não produz histórico novo |
| Foto externa indisponível | Verifique o `foto_url` e o provedor da imagem; a foto não passa pelo túnel do ArdLock |

Compare os resolvedores quando ocorrer erro DNS:

```bash
dig NS jangustavo.me @8.8.8.8
dig ardlock.jangustavo.me @1.1.1.1
dig ardlock.jangustavo.me @8.8.8.8
resolvectl query ardlock.jangustavo.me
sudo resolvectl flush-caches
```

Durante a propagação, resolvedores podem responder de forma diferente. Se o DNS
público resolve e a máquina não, aguarde os caches ou ajuste temporariamente seu
resolvedor. Um teste de diagnóstico pode usar `curl --resolve HOST:443:IP` com um
IP obtido naquele momento no DNS público: isso preserva a validação TLS, mas não
corrige o DNS do navegador. Não fixe IPs da Cloudflare permanentemente no projeto.

## Tokens e referências

O token permite executar o túnel. Guarde-o somente no `.env`, ignorado pelo Git;
não inclua tokens reais em documentação, prints ou logs compartilhados. Se exposto,
rotacione no painel do túnel, substitua no `.env` e recrie o conector:

```bash
docker compose --profile tunnel up -d --force-recreate cloudflared
```

Rotação impede novas conexões com o token antigo; conexões existentes podem
continuar ativas. Em caso de comprometimento, desconecte também as conexões
existentes conforme a documentação Cloudflare. O túnel protege o transporte;
não substitui a autenticação da API nem a autenticação dos dispositivos.

- [Namecheap: delegar DNS à Cloudflare](https://www.namecheap.com/support/knowledgebase/article.aspx/9607/2210/how-to-set-up-dns-records-for-your-domain-in-a-cloudflare-account/)
- [Cloudflare: configurar Tunnel](https://developers.cloudflare.com/tunnel/get-started/)
- [Cloudflare: trocar nameservers](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/)
- [Cloudflare: tokens e rotação](https://developers.cloudflare.com/tunnel/reference/tunnel-tokens/)


## Conferir versão e cache

`make up` e `make build` descartam o cache de camadas e consultam as imagens base
atualizadas. Isso torna a inicialização mais demorada, especialmente na instalação
das dependências Python. Uma falha no build interrompe o processo antes de substituir
os containers da aplicação. O volume PostgreSQL é preservado.

O backend executa o código incluído na imagem. O Compose não monta mais a pasta
`backend/app` sobre esse código; para desenvolvimento com hot reload, use `make dev`.

O Nginx envia `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` para
os arquivos da interface. O Angular também mantém nomes de bundles com hash.
`/version.json` informa o commit e a data UTC de criação da imagem do frontend:

```bash
make version
curl -fsS https://ardlock.jangustavo.me/version.json
curl -I https://ardlock.jangustavo.me/
```

A versão local e pública deve ser a mesma. Após a primeira implantação desta política,
recarregue a página para substituir arquivos que já estavam abertos ou armazenados
antes dela. Uma aba já aberta continua executando o JavaScript carregado até recarregar.
Se houver uma regra personalizada na Cloudflare que ignore os cabeçalhos da origem,
aplique cache bypass ao hostname da aplicação. A configuração atual foi conferida
pelo domínio público, incluindo os cabeçalhos de cache e a versão servida.


## Fuso fixo das permissões de acesso

As permissões (horário inicial/final e dias da semana) usam sempre
`America/Sao_Paulo`, independentemente do fuso do sistema operacional, do Docker ou
do navegador. O RFID, a revalidação facial e a expiração automática compartilham o
mesmo relógio. Por exemplo, `20:10 UTC` corresponde a `17:10` em Brasília; uma
permissão até `18:00` ainda é válida nesse instante. JWT e reset de senha continuam
usando seus relógios UTC próprios.

As conexões PostgreSQL da aplicação também usam esse fuso, alinhando os defaults
SQL e o relógio do backend. A migration `010_add_access_timezone.sql` acrescenta
metadados de fuso ao histórico e às tentativas, sem alterar os valores originais.
Datas antigas em UTC são convertidas ao ler; as novas são gravadas no horário de
São Paulo. A conclusão/expiração de uma tentativa antiga preserva o fuso da linha.
A API e os eventos `NOVO_ACESSO` informam o offset, evitando interpretar UTC como
horário local na interface.

Nesta instalação, o backup de origem identificou por ID e data exata 570 registros
de histórico e 59 tentativas importados do PostgreSQL local, marcados como
`America/Sao_Paulo`. Os registros restantes do Docker foram marcados como UTC.
Em outro banco misturado, reconciliar a origem antes de interpretar dados antigos,
conforme o procedimento de auditoria em `docs/tecnico/FRONTEND.md`.


### Primeira validação facial e versão em execução

Os pesos do InsightFace são baixados durante a construção da imagem. O backend
carrega e aquece o modelo no startup, antes de aceitar requisições. `make up`
aguarda o healthcheck do backend antes de anunciar que a aplicação iniciou.
Assim, a janela de 15 segundos de uma tentativa não inclui o download do modelo.
O navegador antecipa os modelos locais de enquadramento, compartilha um único
carregamento entre chamadas e prepara o detector sem solicitar a câmera.
Permissões de câmera continuam sendo necessárias no primeiro uso do navegador.

Use `make version` para conferir o commit servido. Reconstruir uma branch antiga
continua produzindo código antigo, mesmo com `--no-cache`. Correções mescladas em
uma branch de trabalho só chegam a `master` quando essa branch também é mesclada.
