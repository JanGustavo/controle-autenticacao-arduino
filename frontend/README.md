# Frontend ArdLock

Painel Angular standalone do ArdLock para administração, cadastro biométrico, monitoramento e validação de acesso.

> Documentação detalhada: [docs/FRONTEND.md](../docs/FRONTEND.md)

## Stack

- Angular standalone
- Angular Material
- RxJS
- HttpClient
- Signals
- WebSocket
- SCSS compartilhado

## Executar

```bash
cd frontend
npm ci
npm start
```

Build:

```bash
npm run build
```

No ambiente Docker completo, acesse o painel pela URL definida no compose, normalmente `http://localhost`.

## Estrutura

```text
src/app/
├── pages/
├── services/
├── interceptors/
├── guards/
├── styles/
├── app.routes.ts
└── app.config.ts
```

## Autenticação

O frontend usa JWT administrativo.

```text
Login
  -> AuthService
  -> localStorage
  -> authInterceptor
  -> Authorization: Bearer <JWT>
  -> FastAPI
```

Respostas `401` limpam a sessão e retornam o usuário ao login.

## Validação de acesso

Rota principal:

```text
/validar-acesso
```

Fluxo físico:

```text
RFID real
 -> WebSocket RFID_APROVADO
 -> tentativa_id
 -> webcam
 -> /arduino/verificar-face
 -> decisão
```

Fluxo de desenvolvimento sem RC522:

```text
usuário/UID + dispositivo
 -> Simular cartão
 -> /arduino/verificar-cartao
 -> tentativa_id real
 -> webcam
 -> biometria 1:1 real
```

O simulador não cria um atalho de negócio. Ele usa os mesmos endpoints do fluxo físico.

## Padrões visuais

```text
src/app/styles/
├── _form-pattern.scss
├── _table-pattern.scss
└── _webcam.scss
```

As telas administrativas compartilham padrões de formulário, loading, estado vazio e tabelas responsivas.

## Debug

Use DevTools > Network para conferir:

- URL;
- método;
- Bearer Token;
- payload;
- status HTTP;
- tempo da requisição.

Para o fluxo de acesso, confira em sequência:

```text
verificar-cartao
 -> tentativa_id
 -> verificar-face
 -> tempo_resposta_ms
 -> NOVO_ACESSO
 -> histórico
```

Mais detalhes em [docs/FRONTEND.md](../docs/FRONTEND.md).
