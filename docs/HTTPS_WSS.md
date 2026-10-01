# HTTPS e WSS no ArdLock

O modo seguro usa **Cloudflare Tunnel** sem exigir IPv4 público, port forwarding ou certificado local.
O modo local continua funcionando como antes.

## Modos

### Local

```env
TUNNEL_ENABLED=false
```

```text
http://localhost
http://localhost:8001
ws://localhost:8001/ws/logs
```

### Tunnel

```env
TUNNEL_ENABLED=true
ARDLOCK_DOMAIN=ardlock.jangustavo.me
CLOUDFLARE_TUNNEL_TOKEN=token-do-tunnel
```

```text
https://ardlock.jangustavo.me
wss://ardlock.jangustavo.me/ws/logs
```

Quando `make up` encontra `TUNNEL_ENABLED=true`, ele ativa o profile Docker `tunnel` e sobe o container `cloudflared`.
Quando a variável é `false`, o container nem é iniciado.

## Arquitetura

```text
Navegador / Postman / cliente
          |
       HTTPS/WSS
          |
     Cloudflare
          |
  conexão de saída
          |
     cloudflared
          |
   http://frontend:80
          |
        Nginx
       /     \
    /api     /ws
      \       /
       FastAPI
```

O TLS público termina na Cloudflare. O trecho entre `cloudflared` e o Nginx permanece interno à rede Docker.

## Configuração do domínio

`jangustavo.me` precisa estar ativo no Cloudflare DNS. Se o domínio ainda usa os nameservers da Namecheap,
adicione o domínio à Cloudflare e troque os nameservers na Namecheap pelos dois nameservers informados pela Cloudflare.

Depois crie um tunnel remoto no painel Cloudflare:

```text
Nome do tunnel: ardlock
Public hostname: ardlock.jangustavo.me
Service URL: http://frontend:80
```

O Service URL usa `frontend` porque `cloudflared` e o frontend estão na mesma rede Docker.

## Subir localmente

`.env`:

```env
TUNNEL_ENABLED=false
```

```bash
make up
```

## Subir com HTTPS/WSS

`.env`:

```env
TUNNEL_ENABLED=true
ARDLOCK_DOMAIN=ardlock.jangustavo.me
CLOUDFLARE_TUNNEL_TOKEN=cole-o-token-do-tunnel-aqui
```

```bash
make up
```

O Makefile valida que o token não está vazio antes de iniciar o profile do tunnel.

## Testes rápidos

Local direto no FastAPI:

```bash
curl -i http://localhost:8001/api/v1/health
```

Local passando pelo Nginx:

```bash
curl -i http://localhost/api/v1/health
```

Com o tunnel ativo:

```bash
curl -i https://ardlock.jangustavo.me/api/v1/health
```

No Postman, use a mesma URL HTTPS. Para WebSocket, crie uma requisição WebSocket para:

```text
wss://ardlock.jangustavo.me/ws/logs
```

Depois dispare uma leitura RFID ou uma chamada que gere evento para confirmar o recebimento em tempo real.

## Segurança

O token real do Cloudflare Tunnel nunca deve ser versionado. Guarde-o apenas no `.env` local.
O Tunnel protege transporte e publicação do serviço; autenticação HMAC do ESP32 continua sendo uma fase separada.
