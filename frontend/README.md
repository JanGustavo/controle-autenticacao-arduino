# Frontend — ArdLock

Interface web administrativa do **ArdLock**, construída com Angular. O frontend consome a API REST do backend FastAPI para autenticação, gerenciamento de usuários, locais, permissões e histórico de acessos.

## Stack

- Angular 22
- TypeScript 6
- Angular Material 22
- Angular CDK 22
- RxJS 7.8
- npm 11

As versões e scripts oficiais do projeto estão definidos no `package.json`. fileciteturn10file0L2-L2

## Estrutura

```text
frontend/
├── src/
│   └── app/
│       ├── components/   # Componentes reutilizáveis
│       │   └── navbar/
│       ├── guards/       # Proteção de rotas
│       │   └── auth.guard.ts
│       ├── models/       # Modelos e configurações da interface
│       ├── pages/        # Páginas da aplicação
│       │   ├── adm-page/
│       │   ├── cadastrar/
│       │   ├── entidades/
│       │   ├── locais/
│       │   ├── login/
│       │   ├── permissoes/
│       │   ├── tuple-page/
│       │   └── usuarios/
│       ├── services/     # Comunicação com a API
│       ├── app.config.ts
│       ├── app.routes.ts
│       └── app.ts
├── public/
├── angular.json
├── package.json
├── package-lock.json
├── Dockerfile
└── README.md
```

## Pré-requisitos

- Node.js compatível com Angular 22
- npm 11+

O projeto utiliza `npm@11.12.1` como package manager. fileciteturn10file0L2-L2

## Instalação

```bash
cd frontend
npm install
```

## Desenvolvimento

```bash
npm start
```

A aplicação ficará disponível em:

```text
http://localhost:4200
```

O Angular CLI recarrega a aplicação automaticamente durante alterações no código.

## Comunicação com o backend

O `ApiService` centraliza as chamadas HTTP e utiliza, no ambiente local:

```text
http://localhost:8001/api/v1
```

Ele disponibiliza operações para autenticação, usuários, locais, permissões e histórico de acesso. fileciteturn20file0L2-L2

### Autenticação

```http
POST /api/v1/auth/login
```

O login envia o usuário e a senha para o backend. Em caso de sucesso, o token retornado é armazenado no `localStorage` com a chave `adm_token`, e o usuário é direcionado para o painel administrativo. fileciteturn19file0L2-L2

> **Nota de segurança:** o backend ainda retorna um token aleatório de sessão, não um JWT. O armazenamento no `localStorage` é adequado apenas para o MVP/desenvolvimento atual e deve ser revisado antes de uma versão de produção.

## Rotas

As rotas administrativas utilizam `authGuard`.

| Rota | Acesso | Função |
|---|---|---|
| `/login` | Público | Autenticação administrativa |
| `/adm-page` | Protegido | Página administrativa |
| `/dashboard` | Protegido | Dashboard |
| `/usuarios` | Protegido | Gerenciamento de usuários |
| `/permissoes` | Protegido | Gerenciamento de permissões |
| `/locais` | Protegido | Gerenciamento de locais |
| `/entidades` | Protegido | Visualização de entidades |
| `/cadastrar` | Protegido | Cadastro |

A rota raiz redireciona para `/login` e qualquer rota desconhecida também retorna ao login. fileciteturn18file0L2-L2

## Funcionalidades

### Login

- Login por e-mail e senha
- Validação de campos obrigatórios
- Estado de carregamento
- Exibição de erros retornados pela API
- Controle de visibilidade da senha
- Persistência do token de sessão no navegador

### Usuários

- Listagem
- Cadastro
- Atualização
- Exclusão
- Associação de cartão RFID
- Associação de vetor facial
- Ativação/desativação

### Locais

- Listagem
- Cadastro
- Atualização
- Exclusão
- Identificador do dispositivo
- Ativação/desativação

### Permissões

- Associação entre usuário e local
- Horário inicial e final
- Dias da semana
- Criação, edição e exclusão

### Histórico

- Registro das tentativas de acesso
- Usuário e local
- UID do cartão lido
- Data/hora
- Resultado da autorização
- Percentual de similaridade facial
- Motivo da recusa

## Build de produção

```bash
npm run build
```

Os artefatos são gerados no diretório `dist/`.

## Testes

```bash
npm test
```

O projeto utiliza o runner de testes configurado pelo Angular CLI.

## Docker

O frontend possui um `Dockerfile` próprio e é servido pelo ambiente Docker Compose do projeto. Na execução completa:

```bash
cd ..
docker compose up -d --build
```

A interface fica disponível em:

```text
http://localhost
```

## Fluxo da aplicação

```text
                 ┌──────────────┐
                 │    Login     │
                 └──────┬───────┘
                        │ POST /auth/login
                        ▼
                 ┌──────────────┐
                 │   FastAPI    │
                 └──────┬───────┘
                        │ token
                        ▼
                 ┌──────────────┐
                 │  authGuard   │
                 └──────┬───────┘
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
        Usuários      Locais    Permissões
            │           │           │
            └───────────┼───────────┘
                        ▼
                 Histórico de acesso
```

## Estado atual

O frontend já está estruturado como painel administrativo integrado à API, com autenticação, navegação protegida e telas para as principais entidades do domínio.

A integração com o fluxo físico **ESP32 → RFID → câmera → biometria → decisão de acesso** ainda será incorporada à aplicação.

## Próximas evoluções

- [ ] Configurar URL da API por ambiente (`development` / `production`)
- [ ] Interceptor HTTP para autenticação
- [ ] Melhorar expiração/renovação da sessão
- [ ] Integrar fluxo de autenticação física em tempo real
- [ ] Exibir estado dos dispositivos ESP32
- [ ] Dashboard com métricas reais de acessos
- [ ] Filtros e paginação do histórico
- [ ] Testes unitários e de integração das páginas
