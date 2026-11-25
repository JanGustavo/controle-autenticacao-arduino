# Painel root

A tela /plataforma/root consulta GET /plataforma/api/dashboard com dias (1–365) e
hospedagem (todas, gerenciada ou propria). GET /plataforma/api/clientes/{id} retorna
as operações, licenças, contratos, até 100 faturas e até 100 verificações recentes.
Ambas as rotas exigem uma conta root pelo mecanismo HTTP Basic existente.

A migração 003_dashboard.sql adiciona contrato, fatura e verificacao_operacional.
Valores são BRL. A receita recorrente soma contratos vigentes na data atual.
Faturamento, recebimentos e aberto consideram faturas emitidas no período selecionado,
excluindo canceladas. Cliente ativo tem ao menos uma licença vigente e sem revogação.
Disponibilidade é a proporção de verificações bem-sucedidas no período. O status
atual requer uma verificação dos últimos cinco minutos.

Clientes sem contratos e faturas apresentam valores financeiros zerados. Sem licença
vigente, não entram na contagem de ativos; sem verificações, a disponibilidade é
desconhecida. A seed de apresentação descrita abaixo preenche as duas instâncias
demo. Este módulo não executa sondagens de disponibilidade nem emite cobranças.

Na gaveta de cliente, root pode atribuir os planos Profissional ou Avançado
Empresarial a uma licença existente. A API salva um snapshot JSON versionado do
plano em `licenca.plano_json` e sincroniza os limites de pessoas e dispositivos.
O preço aparece como referência; essa configuração manual não cria contrato,
fatura ou cobrança. O JSON guarda preço e provedor para permitir integrar um
gateway posteriormente.

Filtros de período afetam faturamento e disponibilidade. Receita mensal e licenças
refletem a data atual. Hospedagem afeta todos os totais. A consulta renova a cada
60 segundos com a página visível e a gaveta fechada, ou pelo botão Atualizar dados.

## Apresentação financeira reversível

Na raiz do repositório, execute:

```sh
python3 scripts/seed_demo_financeiro.py --apply
python3 scripts/seed_demo_financeiro.py --clean
```

A seed cria registros de demonstração no PostgreSQL para as instâncias existentes
demo-open-house e demo-horizonte. São dois contratos (R$ 1.490 e R$ 690 mensais),
seis faturas distribuídas em três meses e 180 verificações ao longo de 90 dias.
Esses registros são dados de apresentação, identificados no plano, na origem das
verificações e na tabela seed_demo_financeiro, que guarda os IDs exatos.
Os indicadores operacionais dessa seed representam um cenário demonstrativo.
Uma segunda aplicação não duplica registros. Clean remove somente os IDs registrados,
em transação. Se uma fatura externa passar a depender de um contrato da seed, a
limpeza aborta por integridade referencial, preservando todos os dados.
As sequências de IDs podem avançar, e a tabela de rastreamento permanece vazia.
A criação, limpeza e reaplicação foram executadas durante a validação.

## Instalação Office

`python3 scripts/register_legacy_instance.py` registra a instalação atual como
cliente ardlock-office, com uma licença a partir da data do cadastro e sem fim
definido. O banco operacional continua sendo o existente. A vinculação adiciona
uma conta de gestor, sem copiar ou regravar usuários, fotos e vetores faciais.
A licença inicial e a conta Office são persistentes e não pertencem à seed financeira.

O root abre o cliente ArdLock Office e seleciona Acessar operação. A autenticação
operacional reutiliza o login existente, com usuário gestor.office@ardlock.local
e a senha gestor.office no arquivo privado instances/acessos-plataforma.json.
Esse acesso também abre o catálogo de gestor com login gestor.office.
As sessões de root e da operação têm autenticações próprias. O vínculo usa o domínio
existente e não adiciona acesso operacional aos dois clientes de demonstração.
Os recursos internos preservam o contrato de autorização atual do backend.

## Auditoria interativa

O script scripts/test_root_ui_agent.py importa e adapta o test_ui_agent.py do projeto
Concursos, com browser-use real. A autenticação HTTP Basic inicial é feita no
contexto do Chromium, sem expor a senha ao agente. O agente recebe apenas a senha
operacional como segredo para digitação. O modelo local configurado originalmente
em localhost:3099 estava indisponível; a execução alternativa usa a integração Groq.
Ela usa inspeção DOM, com use_vision=False, e revisão humana das screenshots.

O teste reproduzível scripts/test_root_ui_smoke.py usa o mesmo Chromium real e
valida KPIs, filtros, busca, drawer, login operacional e responsividade.
Execute ambos com o Python da .venv do projeto Concursos, que já possui browser-use
e Playwright. Evidências ficam em .taste-skill/interactive/.

## Licença no módulo cliente

O menu Licença abre /licenca. A tela consulta /plataforma/api/minha-licenca com
o JWT operacional do gestor. A sessão é validada no backend operacional existente,
incluindo validade da assinatura e status ativo do gestor.
OPERATIONAL_BACKEND_URL e OPERATIONAL_INSTANCE_SLUG fixam o vínculo no servidor.
O navegador não escolhe a instância. Nesta instalação, o vínculo é ardlock-office.
Para outra instalação, configure um vínculo próprio e o respectivo backend.

Cliente e root consultam as mesmas tabelas do catálogo de plataforma. A migração
004_license_capacity.sql acrescenta limites opcionais de pessoas credenciadas,
dispositivos e gestores e observações. Campos ausentes aparecem como Não definido,
sem supor uma capacidade ilimitada. Esses campos são informativos nesta etapa.

A próxima cobrança é a fatura não paga e não cancelada de vencimento mais antigo,
incluindo vencidas; o status informa se há atraso. O histórico inclui até 50 faturas.
Vigência considera início, fim e revogação, dando preferência à licença vigente.
A cobrança e os contratos não são copiados para o banco operacional.
