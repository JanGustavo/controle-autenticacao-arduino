# Frontend ArdLock

O frontend é um painel Angular standalone com Angular Material. Ele cobre administração do sistema e o Totem de validação de acesso.

## Stack

- Angular standalone components
- Angular Material
- RxJS
- HttpClient
- Signals para estado local
- WebSocket nativo
- sem NgRx

## Organização

```text
src/app/
├── pages/         # telas e fluxos
├── services/      # API, autenticação, webcam, WebSocket e voz
├── interceptors/  # Authorization Bearer
├── guards/        # proteção de navegação
├── styles/        # padrões compartilhados
├── app.routes.ts
└── app.config.ts
```

## Autenticação

O login salva o JWT administrativo.

O `authInterceptor`:

1. lê o token pelo `AuthService`;
2. ignora rotas públicas de autenticação;
3. injeta `Authorization: Bearer <token>`;
4. em `401`, limpa a sessão e redireciona para `/login`.

## Tela de validação de acesso

Rota principal:

```text
/validar-acesso
```

A rota antiga `/comparar` é apenas um redirect.

A tela suporta dois caminhos.

### Hardware real

```text
ESP32 lê RFID
  -> backend cria tentativa
  -> WebSocket RFID_APROVADO
  -> frontend recebe tentativa_id
  -> webcam
  -> validação facial
```

### Simulação sem RFID físico

```text
Selecionar usuário / UID
  -> selecionar dispositivo
  -> Simular cartão
  -> POST /arduino/verificar-cartao
  -> tentativa_id real
  -> webcam
  -> POST /arduino/verificar-face
```

O simulador não usa endpoint fake. Ele usa o mesmo fluxo HTTP do hardware.

## Webcam e biometria

A interface:

- inicia a webcam somente quando existe uma tentativa;
- orienta posicionamento facial;
- captura frame;
- envia imagem como `multipart/form-data`;
- recebe similaridade, decisão e tempo de resposta;
- atualiza feedback visual/sonoro;
- atualiza histórico.

A decisão não é calculada no Angular.

## WebSocket

Endpoint:

```text
/ws/logs
```

Eventos relevantes:

| Evento | Uso |
|---|---|
| RFID_LIDO | leitura detectada |
| RFID_APROVADO | tentativa criada |
| RFID_NEGADO | elegibilidade recusada |
| NOVO_ACESSO | decisão final/histórico atualizado |

O frontend deve tratar HTTP e WebSocket como canais complementares. Durante a simulação, a resposta HTTP é a fonte da tentativa para evitar inicialização duplicada da webcam pelo broadcast da própria requisição.

## Padrão visual

Padrões compartilhados:

```text
src/app/styles/
├── _form-pattern.scss
├── _table-pattern.scss
└── _webcam.scss
```

Formulários usam:

- card consistente;
- labels flutuantes;
- estados inline de erro;
- botões primário/secundário padronizados.

Listagens usam:

- tabela responsiva;
- skeleton loading;
- estado vazio;
- cabeçalho fixo;
- rolagem consistente.

## API Service

`api.service.ts` concentra contratos HTTP do frontend.

Evite chamadas `HttpClient` diretas dentro de páginas quando já existir método equivalente no service.

Fluxo recomendado:

```text
Page
 -> ApiService
 -> HttpInterceptor
 -> FastAPI
```

## Debug

Rodar localmente:

```bash
cd frontend
npm ci
npm start
```

Build:

```bash
npm run build
```

Checklist rápido:

1. login;
2. confirmar JWT no DevTools > Network;
3. abrir `/validar-acesso`;
4. selecionar usuário e dispositivo;
5. simular RFID;
6. confirmar `tentativa_id`;
7. liberar permissão da câmera;
8. validar face;
9. conferir decisão e `tempo_resposta_ms`;
10. conferir histórico.

## Erros comuns

### 401 após login

Verifique:

- token salvo;
- interceptor registrado em `app.config.ts`;
- header `Authorization`;
- expiração do JWT;
- administrador ainda ativo.

### Select de dispositivo vazio

Verifique:

- `GET /api/v1/dispositivos?ativo=true`;
- JWT;
- existência de dispositivos ativos;
- vínculo com local.

### Webcam não inicia

Verifique:

- permissão do navegador;
- contexto seguro quando não estiver em localhost;
- existência de `tentativa_id`;
- console do navegador.

### WebSocket não conecta

Verifique a URL calculada pelo `WebSocketLogsService` e se o backend está acessível na porta esperada.
