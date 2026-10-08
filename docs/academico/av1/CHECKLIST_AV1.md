# Preparação da primeira entrega do ArdLock

Plano inicial em 08/10/2026, baseado nas
[orientações do professor](orienta_es_projeto_integrador_av1.md) e na documentação
atual do projeto. A próxima prioridade é revisar as telas do fluxo principal e
capturar evidências para o PDF. Este checklist não certifica execução do sistema;
separa implementação documentada, resultados relatados e verificações pendentes.

## Entrega e avaliação

- [ ] Entregar o PDF no Teams até **14/10/2026 às 18h**, horário local.
- [ ] Confirmar a data sorteada: apresentações em 14, 21 ou 22 de outubro.
- [ ] Incorporar todo o conteúdo no PDF, incluindo telas e fluxo; a apresentação
  ocorre exclusivamente pelo arquivo entregue, sem depender do sistema ao vivo.
- [ ] Ensaiar até 10 minutos e preparar respostas para até 5 minutos de perguntas.
- [ ] Garantir participação efetiva de todos e domínio geral do projeto.
- [ ] Revisar o arquivo antes do prazo: não há substituição após o encerramento.

| Critério | Pontos | Material e pendência |
|---|---:|---|
| Problema, objetivo e justificativa | 1,5 | Base nos requisitos; fechar o público-alvo e o contexto concreto |
| Escopo e funcionalidades | 2,0 | Separar prioridades, limites e estado de cada funcionalidade |
| Telas e fluxo | 2,5 | Revisar visualmente a interface e capturar o percurso no PDF |
| Aspectos técnicos | 2,0 | Sintetizar arquitetura e justificar decisões, com limitações atuais |
| Planejamento, participação e domínio | 2,0 | Definir responsáveis, entregas, riscos e ensaiar em grupo |

## Identificação e proposta

**Nome:** ArdLock — Controle de Acesso.

**Integrantes registrados no documento formal:** Janderson Gustavo Alves da Silva,
Lucas Paulino da Silva e Deyvid André da Costa. Confirmar a composição antes do PDF.

**Tipo de solução:** aplicação web administrativa integrada a um protótipo físico
com ESP32/RFID e validação facial 1:1 processada no backend.

**Formulação proposta do problema:** um cartão válido pode ser usado por outra
pessoa; o responsável pelo ambiente precisa verificar o titular, aplicar regras
de acesso por local e horário e consultar tentativas autorizadas ou recusadas.
Validar essa formulação com o contexto escolhido pela equipe.

**Objetivo proposto:** desenvolver um protótipo que combine cartão RFID e
verificação facial do titular com regras de autorização e histórico, permitindo
administrar e acompanhar o acesso físico.

**Benefícios esperados:** confirmação adicional do titular do cartão, controle
centralizado das permissões e rastreabilidade. Não apresentar redução de incidentes,
acurácia ou desempenho como resultados medidos sem evidência.

- [ ] Escolher público-alvo e ambiente de aplicação concretos.
- [ ] Explicar quem enfrenta o problema e as limitações do processo atual.
- [ ] Confirmar objetivo e resultados esperados no contexto escolhido.

## Recorte proposto para AV1

**Prioridades:** cadastro de usuário com cartão e biometria; configuração de local,
dispositivo e permissão; validação RFID → rosto → decisão; consulta do histórico.
Login administrativo é a entrada do fluxo de gestão.

**Perfis:** administrador gerencia cadastros e permissões; portador do cartão
participa da validação física. Portador não é necessariamente uma conta de login
no painel. A conta administrativa principal possui proteções específicas; não
apresentar como implementada uma matriz de cargos/permissões que não foi verificada.

**Limites propostos:** protótipo de bancada, sem promessa de operação comercial;
comparação facial 1:1, sem busca de pessoas 1:N. Fechadura real, modo offline,
notificações externas e ampliação da biometria ficam fora do recorte proposto.

| Parte do projeto | Estado registrado | Como apresentar |
|---|---|---|
| Gestão web, autenticação administrativa, permissões e histórico | Implementação descrita nos guias e rotas existentes | Capturar e conferir as telas atuais antes de afirmar funcionamento na entrega |
| RFID e face 1:1 com decisão do backend | Testes automatizados e aprovação relatada na rodada de 04/10 | Identificar a evidência e preparar imagens atuais do fluxo |
| LEDs e buzzer | Sinalização aprovada por relato; volume baixo | Confirmar o conjunto usado na apresentação; não estender essa aprovação ao servo |
| Servo simulando a porta | Integração física pendente por ausência do componente | Identificar como pendente; decisão de software não comprova abertura física |
| Releitura rápida após correção | Correção automatizada registrada; teste manual pendente | Manter verificação de bancada aberta |
| Dez acessos com tempo medido | Pendente | Meta de resposta inferior a 4 s não é desempenho comprovado |
| HMAC por dispositivo | Planejado; relatório registra ausência de autenticação nas rotas físicas | Explicar risco e próxima proteção, sem declarar implementada |
| Similaridade facial de 0,80 | Limiar operacional definido; calibração real pendente | Não chamar de 80% de precisão ou probabilidade de identidade |

Fontes: [requisitos](../../requisitos/Arduino-acess-control.md),
[homologação](../../testes/ROTEIRO_HOMOLOGACAO.md),
[biometria](../../tecnico/RECONHECIMENTO_FACIAL.md) e
[relatório de segurança](<../../seguranca/Relatorio laboratorio seguranca ArdLock.docx>).

## Telas e fluxo no PDF

Percurso a preparar: **login → cadastro de usuário/RFID/biometria → permissão por
local e horário → validação do acesso → resultado → histórico**. Mostrar a
configuração de local/dispositivo como contexto e incluir um caso de recusa.
Usar dados fictícios próprios para demonstração.

- [ ] Revisar login, cadastro, usuários, permissões, validação e histórico.
- [ ] Padronizar menus, títulos, botões, cores, ícones, campos e espaçamentos.
- [ ] Conferir legibilidade e contraste na projeção e no PDF.
- [ ] Conferir confirmação, campos inválidos, carregamento, estado vazio e erro.
- [ ] Mostrar o usuário ativo, cartão/biometria e a permissão do caso autorizado.
- [ ] Capturar estados de espera, captura facial e resultado autorizado.
- [ ] Capturar uma recusa com motivo compreensível e seu registro no histórico.
- [ ] Mostrar o papel do administrador e o percurso do portador do cartão.
- [ ] Conferir o aparelho responsável pela câmera antes de obter as evidências.
- [ ] Registrar data, commit, ambiente e tipo de evidência das capturas.

A interface ainda precisa de avaliação visual; padrões descritos nos guias não
substituem essa avaliação. Capturar após as melhorias evita refazer os slides.

## Aspectos técnicos

- [ ] Explicar Angular/TypeScript/Material, Python/FastAPI e PostgreSQL.
- [ ] Mostrar arquitetura: ESP32 e navegador → API/serviços → banco; backend
  calcula a autorização e ESP32 executa o comando.
- [ ] Explicar REST para operações e WebSocket para eventos em tempo real.
- [ ] Explicar InsightFace/ONNX e comparação do vetor apenas com o titular.
- [ ] Identificar Docker e ambiente de execução, sem confundir processamento
  local da biometria com acesso público à interface por HTTPS.
- [ ] Mencionar Git, login JWT, hash de senha e proteção das rotas administrativas.
- [ ] Explicar uso dos embeddings e verificar o tratamento de dados/imagens
  antes de afirmar cumprimento integral dos requisitos de privacidade.
- [ ] Incluir a pendência de autenticação do dispositivo e suas mitigação e validação.

Consultar [backend](../../tecnico/BACKEND.md), [frontend](../../tecnico/FRONTEND.md)
e [execução](../../operacao/EXECUCAO.md). Não usar números antigos de testes como
resultado atual sem executar e registrar a versão correspondente.

## Planejamento e responsabilidades

Sequência proposta para os próximos dias, sujeita à confirmação da equipe:

| Período | Entrega prevista | Responsável |
|---|---|---|
| 08/10 | Organização documental e checklist inicial | Preparado nesta revisão; validar em grupo |
| 09–10/10 | Fechar público-alvo/escopo e revisar a interface do fluxo principal | A definir |
| 11/10 | Verificar fluxo e obter capturas, incluindo recusa e histórico | A definir |
| 12/10 | Montar slides e roteiro de fala | A definir |
| 13/10 | Ensaiar em grupo e revisar/exportar o PDF | Todos; coordenação a definir |
| 14/10 antes das 18h | Conferir arquivo final e enviar pelo Teams | A definir |

- [ ] Confirmar nomes, disponibilidade e divisão real das atividades.
- [ ] Distribuir falas com conteúdo substantivo para cada integrante.
- [ ] Preparar respostas sobre biometria, limites do hardware e segurança.

| Risco | Estratégia proposta |
|---|---|
| PDF depender de conexão ou demonstração ao vivo | Incorporar telas, mensagens e sequência de uso no arquivo |
| Câmera, iluminação ou variação biométrica | Verificar com a câmera escolhida e condições estáveis; registrar o que foi observado |
| Servo indisponível | Delimitar a simulação física pendente, mostrar o resultado observado e planejar integração |
| Segurança da comunicação do ESP32 | Registrar lacuna atual; planejar autenticação do dispositivo e proteção do transporte/comandos |
| Escopo excessivo para a entrega | Concentrar-se no fluxo principal e nas exigências da AV1 |
| Estouro dos dez minutos | Ensaiar com cronômetro e reduzir conteúdo acessório |

## Roteiro de dez minutos

| Parte | Tempo | Conteúdo |
|---|---:|---|
| Identificação | 30 s | Nome, integrantes, público-alvo e modalidade |
| Problema e justificativa | 1 min | Situação atual, pessoas afetadas e relevância |
| Objetivo | 1 min | Resultado esperado e benefícios |
| Escopo | 2 min | Prioridades, perfis, limites e estado da implementação |
| Telas e fluxo | 3 min | Percurso autorizado, recusa, mensagens e histórico |
| Aspectos técnicos | 1 min 30 s | Arquitetura, tecnologias, segurança e privacidade |
| Planejamento | 1 min | Atividades, responsáveis, próximas entregas e riscos |
| **Total** | **10 min** | Ensaiar também as transições entre integrantes |

## Ajustes documentais ainda necessários

- [ ] Alinhar o documento Word: interface web e login já aparecem como
  implementados nos guias, mas constam como evolução futura no texto formal.
- [ ] Consolidar o roteiro de homologação distinguindo teste com mocks, relato
  de bancada, evidência observada e pendência, preservando o histórico.
- [ ] Atualizar este checklist com evidências e decisões reais antes do PDF.
