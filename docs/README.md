# Documentação do ArdLock

Para preparar a primeira entrega, comece pelo
[checklist da AV1](academico/av1/CHECKLIST_AV1.md). Os documentos foram organizados
por finalidade em 08/10/2026; os arquivos Word foram preservados sem alterações.

| Área | Documentos |
|---|---|
| Acadêmico AV1 | [Orientações do professor](academico/av1/orienta_es_projeto_integrador_av1.md) e [checklist da entrega](academico/av1/CHECKLIST_AV1.md) |
| Requisitos | [Requisitos e atualizações do protótipo](requisitos/Arduino-acess-control.md) e [documento formal](<requisitos/Documento de Requisitos 1.docx>) |
| Técnico | [Backend](tecnico/BACKEND.md), [frontend](tecnico/FRONTEND.md) e [reconhecimento facial](tecnico/RECONHECIMENTO_FACIAL.md) |
| Operação | [Execução e builds](operacao/EXECUCAO.md) e [HTTPS, WSS e ambientes](operacao/HTTPS_WSS.md) |
| Testes | [API e diagnóstico](testes/API_DEBUG.md) e [homologação em bancada](testes/ROTEIRO_HOMOLOGACAO.md) |
| Segurança | [Relatório do laboratório](<seguranca/Relatorio laboratorio seguranca ArdLock.docx>) e [laboratório reproduzível](../security/lab_sem_hmac/README.md) |

## Organização e manutenção

- As orientações do professor definem os requisitos da AV1. O checklist é o plano
  de preparação da equipe, não uma alteração dessas orientações.
- O Markdown de requisitos registra atualizações de validação posteriores ao
  documento formal Word. Alinhar o Word antes de reutilizá-lo como versão atual.
- O antigo `BUILDS.md` foi consolidado em `operacao/EXECUCAO.md`, com comandos e
  portas corrigidos. API/debug foi preservado como ferramenta de diagnóstico.
- O roteiro de homologação mantém o histórico original. Alguns resultados usam
  mocks e outros são relatos de bancada; o checklist distingue essas evidências.
- Salvar futuramente o roteiro de fala e o PDF em `academico/av1/`. Imagens de telas
  e evidências podem ficar em `academico/av1/evidencias/`, com dados de demonstração.
- Ao mover um documento, atualizar também os links dos READMEs e as referências
  no código. Evitar duplicar guias operacionais ou apagar evidências históricas.
