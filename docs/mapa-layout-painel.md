# Mapa visual do painel ArdLock

Referência: `/ia`. As telas administrativas usam largura máxima de 1340 px, espaçamento lateral responsivo, cabeçalho com ícone de 64 px (52 px em telas estreitas) e degradês suaves nos dois lados, inclusive no final da página. Cada módulo mantém sua cor e seu símbolo.

| Rota | Tela | Ícone | Cor | Estrutura |
| --- | --- | --- | --- | --- |
| `/adm-page` | Painel | `dashboard` | Azul | Cabeçalho compartilhado |
| `/ia` | iArdLock Insights | `auto_awesome` | Violeta e rosa | Referência visual |
| `/usuarios` | Usuários | `group` | Azul | Cabeçalho compartilhado |
| `/permissoes` | Permissões | `vpn_key` | Âmbar | Cabeçalho compartilhado |
| `/dashboard` | Histórico de acesso | `history` | Ciano | Cabeçalho compartilhado |
| `/validar-acesso` e `/comparar` | Validar acesso | `face` | Verde | Cabeçalho compartilhado; modo kiosk sem cabeçalho |
| `/locais` | Locais | `location_on` | Laranja | Cabeçalho e cards na mesma largura |
| `/dispositivos` | Dispositivos | `memory` | Turquesa | Cabeçalho e cards na mesma largura |
| `/administradores` | Administradores | `admin_panel_settings` | Vermelho | Cabeçalho compartilhado |
| `/audit-logs` | Auditoria | `fact_check` | Violeta | Cabeçalho compartilhado |
| `/entidades` | Modelo de dados | `account_tree` | Índigo | Cabeçalho compartilhado |
| `/cadastrar` | Cadastro de usuário | `person_add` | Azul | Cabeçalho compartilhado; formulário próprio |

`/login`, `/forgot-password` e `/reset-password` são fluxos de autenticação e não usam o cabeçalho do painel.

Este mapa acompanha a padronização visual do painel. A correção anterior da tabela Markdown está no commit `8ef2bd2`.
