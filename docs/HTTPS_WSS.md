# HTTPS e WSS no ArdLock

O stack Docker usa **Caddy** como gateway TLS na frente do frontend Nginx e do FastAPI.

## Endereço planejado

```text
https://ardlock.jangustavo.me
wss://ardlock.jangustavo.me/ws/logs
```

O tráfego externo termina no Caddy:

```text
Internet/LAN
    |
  80/443
    |
  Caddy
   |  \
   |   \-- /api/* e /ws/* -> backend:8000
   |
   \------ restante -> frontend:80
```

O WebSocket não precisa de configuração TLS separada: quando a página abre por HTTPS,
o Angular usa `wss://` e o Caddy faz o upgrade WebSocket no mesmo domínio.

## DNS na Namecheap

Crie um registro:

```text
Type:  A Record
Host:  ardlock
Value: <IPv4 público da sua rede>
TTL:   Automatic
```

O host é somente `ardlock`, não `ardlock.jangustavo.me`.

## Pré-requisitos de certificado público

Para o Caddy obter um certificado público automaticamente:

1. `ardlock.jangustavo.me` deve resolver para o IPv4 público correto;
2. as portas TCP 80 e 443 do roteador devem chegar à máquina que executa o Docker;
3. o firewall local deve permitir 80/443;
4. não pode haver outro processo ocupando essas portas;
5. se o provedor usar CGNAT, o encaminhamento IPv4 tradicional pode não funcionar.

## Variável de ambiente

No `.env`:

```env
ARDLOCK_DOMAIN=ardlock.jangustavo.me
```

## Subir

```bash
docker compose up -d --build
docker compose logs -f caddy
```

Quando o certificado for emitido:

```text
https://ardlock.jangustavo.me
```

deve abrir sem aviso de certificado.

## Desenvolvimento local

`make dev` continua usando:

```text
http://localhost:4200
http://localhost:8001
ws://localhost:8001/ws/logs
```

A camada HTTPS/WSS é voltada ao stack Docker e não quebra o fluxo local sem TLS.
