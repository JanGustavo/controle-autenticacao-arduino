# Arquitetura do backend

O backend segue um padrão simples:

```text
API -> Service -> Model -> PostgreSQL
```

Os schemas Pydantic continuam separados porque representam contratos HTTP,
não uma camada de regra de negócio.

## API

Local: `app/api/`

Responsável por:

- rotas FastAPI;
- path, query, body e upload;
- autenticação e `Depends`;
- status e contratos HTTP;
- eventos WebSocket ligados à interface HTTP;
- chamada do Service.

Não deve conter SQL nem regra de negócio.

## Service

Local: `app/services/`

Responsável por:

- regra de negócio;
- normalização do domínio;
- coordenação entre Models;
- transações que envolvam mais de uma operação;
- decisões do fluxo.

Não deve conter SQL.

## Model

Local: `app/models/`

Responsável por:

- SELECT, INSERT, UPDATE e DELETE;
- conversão de linhas do PostgreSQL;
- consultas específicas da entidade.

Não decide se uma ação de negócio deve acontecer.

## Schema

Local: `app/schemas/`

Responsável por:

- validação de entrada;
- contratos de resposta;
- DTOs Pydantic.

Schema não substitui Model.

## Exemplo

```text
GET /usuarios/10
       |
       v
api/usuarios.py
       |
       v
services/usuario_service.py
       |
       v
models/usuario_model.py
       |
       v
PostgreSQL
```

## Regra para novos endpoints

Ao implementar uma funcionalidade, pergunte:

- É HTTP? -> API
- É decisão/regra? -> Service
- É SQL? -> Model
- É contrato de dados? -> Schema

Evite criar novas camadas ou classes genéricas sem uma duplicação real que
justifique a abstração.
