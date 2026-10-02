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

## Gestão de usuários

A listagem em `/usuarios` fecha o CRUD administrativo com criação, consulta,
edição e exclusão.

A edição usa um modal único com três blocos independentes:

```text
Dados básicos
  -> PATCH /usuarios/{id}
  -> nome + ativo

Cartão RFID
  -> leitura via WebSocket RFID_LIDO ou UID informado
  -> POST /arduino/cadastrar-cartao
  -> substitui/associa o cartão do usuário

Biometria facial
  -> webcam ou arquivo
  -> POST /biometria/cadastrar/{usuario_id}
  -> substitui o embedding facial
```

RFID e vetor facial não são alterados diretamente pelo `PATCH /usuarios/{id}`.
Essa separação preserva validações específicas, auditoria e o contrato com o
hardware.

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

## RFID físico e abertura automática da câmera

Com uma sessão administrativa ativa e a interface aberta, `RfidAccessService`
escuta o WebSocket globalmente. Um evento `RFID_APROVADO` com `tentativa_id` leva
à tela `/validar-acesso`, mesmo que o navegador esteja em outra página. A tentativa
é preservada durante a navegação e consumida uma única vez. Na tela de validação,
o mesmo evento abre a câmera também com o modo de captura manual selecionado;
a captura automática continua dependendo do modo Totem. `RFID_LIDO` ou um cartão
negado não abrem a câmera. A resposta HTTP continua conduzindo a simulação para
não iniciar a câmera duas vezes.

A seleção compartilhada por validação e cadastro tenta os dispositivos nesta ordem:

1. DroidCam.
2. USB/externas reconhecidas pelo nome do driver.
3. Dispositivos cujo tipo não é identificado pelo nome.
4. Câmera interna do notebook reconhecida pelo nome do driver.

Cada dispositivo usa `deviceId` exato. Se DroidCam estiver listado mas ocupado ou
indisponível, a seleção tenta USB antes da interna, sem usar `ideal` para delegar
a escolha ao navegador. Nomes de drivers são heurísticos: uma câmera USB com nome
não reconhecido entra entre os dispositivos de tipo desconhecido. Quando ainda
não há permissão, uma abertura inicial pode ser necessária para revelar os nomes;
essa transmissão é encerrada antes da troca para a câmera preferida.

A câmera pertence ao computador/celular onde o navegador está aberto. DroidCam
precisa estar conectado e aparecer como dispositivo de vídeo nesse computador.
O navegador exige autorização para usar a câmera: permissão negada não é contornada.
Ao sair da página ou cancelar, uma abertura ainda em andamento é invalidada e o
stream obtido depois é encerrado.

Teste com `cd frontend && npm run test:cameras` (Node 24 com suporte a TypeScript).
Para testar o fluxo físico, abra uma página diferente de Validar Acesso, passe um
cartão autorizado e confira a navegação e a câmera escolhida. Repita com DroidCam
indisponível e depois com USB indisponível. Outros navegadores autenticados que
recebam o mesmo broadcast também podem entrar na validação; o fluxo não elege um
único navegador operador nem identifica automaticamente a câmera de outra máquina.


### Layout em telas menores e administradores

O cabeçalho fica compacto no celular, preservando avatar, tema e saída. Até 760 px,
formulários e filtros usam uma coluna e margens menores; campos usam fonte de 16 px
para evitar zoom automático ao digitar em navegadores móveis. As tabelas preservam
suas colunas, com rolagem horizontal dentro do cartão, sem alargar a página.

Em **Administradores**, a lista ocupa o centro da página e as células ficam
centralizadas. O botão **Cadastrar administrador** abre um modal sobre a lista;
a edição usa o mesmo formulário. O modal limita sua altura à tela, permite rolagem,
prende o foco durante o uso e devolve o foco ao botão ao fechar. Cancelar, fechar ou
pressionar Escape limpa o formulário; durante o envio essas ações ficam bloqueadas.
A conta principal continua protegida contra exclusão e desativação, e deixar a senha
vazia na edição preserva a senha atual.


### Horários de auditoria

A API de auditoria retorna `created_at` em ISO 8601 com fuso explícito (por exemplo,
`2026-10-02T19:01:11+00:00`). A interface converte esse instante para o fuso do
navegador: em Brasília, o exemplo aparece como `02/10/2026 16:01:11`.
Cloudflare Tunnel não modifica esses horários.

A migration `009_add_audit_timezone.sql` mantém a coluna de data original e adiciona
`created_at_timezone`. Novos registros recebem o fuso da sessão PostgreSQL; a API
interpreta cada data nesse fuso e ordena pelos instantes reais. A migration pode ser
repetida sem sobrescrever os fusos já registrados.

Em uma importação antiga de um banco com fuso diferente, os registros importados
precisam ser reconciliados com o backup de origem: atualizar apenas
`created_at_timezone` nos registros cujo ID e data original correspondam ao backup.
Não subtraia três horas de toda a tabela, pois dados locais e Docker podem ter sido
gravados em fusos diferentes. Nesta instalação, os 446 registros importados foram
identificados por correspondência exata e marcados como `America/Sao_Paulo`; os
registros posteriores do Docker permanecem em UTC. As datas originais foram preservadas.
