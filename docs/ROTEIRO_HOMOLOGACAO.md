# Roteiro de Homologação em Bancada — ArdLock

Este roteiro foi feito para a rodada de testes presenciais do ArdLock com registro em vídeo, screenshots e fotos do hardware.

Marque cada item como:

- [ ] Pendente
- [x] Passou
- [!] Falhou
- [-] Bloqueado / não testável no momento

> Regra de ouro: um teste só conta como aprovado quando o comportamento foi observado. Encontrar código não substitui evidência de execução.

---

## 1. Preparação da sessão

### Ambiente

- [ ] Backend iniciado sem erro.
- [ ] Frontend iniciado sem erro.
- [ ] PostgreSQL ativo.
- [ ] Swagger acessível.
- [ ] Totem em `/validar-acesso`.
- [ ] Webcam funcionando.
- [ ] ESP32 conectado à rede.
- [ ] RC522 lendo cartões.
- [ ] LED verde funcionando.
- [ ] LED vermelho funcionando.
- [ ] Buzzer funcionando.
- [ ] Servo conectado/alimentado de forma segura.
- [ ] Relógio da máquina do backend correto.

### Dados que devem existir antes dos testes

Crie ou confirme pelo menos:

- usuário **A**, ativo, com RFID e biometria cadastrados;
- usuário **B**, ativo, com RFID e biometria cadastrados;
- usuário **C**, inativo;
- local **Entrada Principal**, ativo;
- dispositivo **ESP32-ENTRADA-01**, ativo, vinculado ao local;
- uma permissão válida para o usuário A;
- uma permissão propositalmente fora do horário;
- uma permissão para dia diferente, se possível;
- pelo menos um cartão não cadastrado.

### Evidências gerais

Durante a sessão, tente capturar:

- tela do Totem;
- resposta visual do frontend;
- Serial Monitor do ESP32;
- LED/buzzer/servo;
- Swagger ou Network do navegador;
- linha criada em `tentativa_acesso`;
- linha criada em `historico_acesso`;
- `tempo_resposta_ms`.

---

# 2. Testes do fluxo principal

## T01 — Acesso autorizado completo

**Objetivo:** provar o fluxo nominal inteiro.

**Preparação:**

- usuário A ativo;
- cartão A cadastrado;
- biometria A cadastrada;
- permissão válida para o local;
- dia e horário atuais dentro da permissão;
- local e dispositivo ativos.

**Passos:**

1. Passe o cartão A.
2. Observe o feedback após o RFID.
3. Posicione o rosto do usuário A.
4. Aguarde a captura automática.
5. Observe a decisão final.
6. Confira o histórico.

**Esperado:**

- RFID aceito;
- `tentativa_id` criada;
- câmera inicia somente após o cartão;
- comparação facial 1:1 aprovada;
- tela mostra acesso liberado;
- LED verde / buzzer de sucesso;
- servo executa abertura, se conectado;
- histórico registra autorizado;
- `tempo_resposta_ms` preenchido;
- câmera encerra após o ciclo;
- sistema volta a aguardar novo cartão.

**Evidência sugerida:**

- [ ] vídeo do ciclo completo;
- [ ] screenshot de "Acesso liberado";
- [ ] foto/vídeo do LED/servo;
- [ ] screenshot do histórico.

**Resultado:** [ ]

**Observações:**

---

## T02 — Cartão válido, mas fora do horário

**Objetivo:** provar que regras baratas bloqueiam antes da biometria.

**Preparação:**

- cartão válido;
- usuário ativo;
- local/dispositivo ativos;
- permissão existente;
- ajuste a permissão para terminar antes do horário atual.

**Passos:**

1. Passe o cartão.
2. Não altere a face nem interaja com a câmera.
3. Observe mensagem e hardware.

**Esperado:**

- acesso recusado imediatamente;
- mensagem indicando regra de horário;
- câmera não deve iniciar;
- não deve gerar embedding facial;
- LED vermelho / buzzer de recusa;
- servo não abre;
- histórico registra negação e motivo.

**Evidência sugerida:**

- [ ] screenshot da permissão/horário;
- [ ] vídeo da leitura + recusa sem câmera;
- [ ] screenshot do histórico com motivo.

**Resultado:** [ ]

**Observações:**

---

## T03 — Cartão válido, mas dia da semana não permitido

**Objetivo:** validar regra de dias.

**Preparação:**

- usuário/cartão válidos;
- permissão configurada sem o dia atual.

**Passos:**

1. Passe o cartão.
2. Observe a resposta.

**Esperado:**

- negação antes da biometria;
- mensagem coerente com dia não permitido;
- câmera não abre;
- histórico registra motivo;
- servo permanece fechado.

**Resultado:** [ ]

**Observações:**

---

## T04 — Usuário sem permissão para o local

**Objetivo:** validar vínculo Usuário → Permissão → Local.

**Preparação:**

- usuário B ativo;
- cartão B válido;
- usuário B sem permissão para a Entrada Principal.

**Passos:**

1. Passe o cartão B no dispositivo da Entrada Principal.

**Esperado:**

- RFID reconhece o cartão, mas elegibilidade é negada;
- câmera não inicia;
- motivo indica ausência de permissão;
- histórico registra a recusa;
- servo não abre.

**Resultado:** [ ]

**Observações:**

---

## T05 — Usuário inativo

**Objetivo:** garantir que um usuário desativado não entra mesmo com cartão conhecido.

**Preparação:**

- marque o usuário C como inativo;
- mantenha cartão cadastrado.

**Passos:**

1. Passe o cartão do usuário C.

**Esperado:**

- acesso negado antes da biometria;
- feedback informa usuário inativo ou não autorizado;
- câmera não inicia;
- histórico registra recusa.

**Resultado:** [ ]

**Observações:**

---

## T06 — Dispositivo inativo

**Objetivo:** garantir que um leitor desativado não inicia o fluxo.

**Preparação:**

- desative `ESP32-ENTRADA-01` no painel.

**Passos:**

1. Tente passar um cartão válido nesse dispositivo.

**Esperado:**

- tentativa recusada;
- câmera não inicia;
- nenhum comando de liberação é emitido;
- motivo fica rastreável no backend/histórico conforme implementação.

**Resultado:** [ ]

**Observações:**

---

## T07 — Local inativo

**Objetivo:** provar que desativar o local bloqueia todos os dispositivos daquele local.

**Preparação:**

- reative o dispositivo;
- desative o local associado.

**Passos:**

1. Passe cartão válido.

**Esperado:**

- acesso negado antes da biometria;
- câmera não inicia;
- servo não abre.

**Resultado:** [ ]

**Observações:**

---

## T08 — Cartão não cadastrado

**Objetivo:** validar rejeição de RFID desconhecido.

**Passos:**

1. Passe um cartão não cadastrado.

**Esperado:**

- recusa imediata;
- feedback de cartão não reconhecido;
- câmera não inicia;
- LED vermelho / buzzer de recusa;
- nenhum acesso é liberado.

**Resultado:** [ ]

**Observações:**

---

# 3. Testes biométricos 1:1

## T09 — Cartão A + rosto A

**Objetivo:** comprovar match correto do titular.

**Passos:**

1. Passe cartão A.
2. Apresente rosto A.

**Esperado:**

- aprovado;
- similaridade acima do threshold operacional de 0.80;
- histórico autorizado.

**Resultado:** [ ]

**Similaridade observada:** ______

---

## T10 — Cartão A + rosto B

**Objetivo:** provar que o sistema não aceita outra pessoa usando cartão alheio.

**Passos:**

1. Passe cartão A.
2. Quando a câmera abrir, apresente o rosto B.

**Esperado:**

- comparação ocorre somente contra o vetor do usuário A;
- acesso negado;
- similaridade abaixo do threshold;
- motivo biométrico registrado;
- servo não abre.

**Evidência sugerida:**

- [ ] screenshot com cartão/titular A identificado;
- [ ] screenshot do resultado negado;
- [ ] histórico com similaridade.

**Resultado:** [ ]

**Similaridade observada:** ______

---

## T11 — Rosto ruim / iluminação insuficiente

**Objetivo:** validar feedback do Totem antes do envio.

**Passos:**

1. Inicie tentativa válida.
2. Reduza iluminação ou fique parcialmente fora do quadro.

**Esperado:**

- mensagem de iluminação/rosto não detectado;
- captura automática não dispara enquanto o enquadramento estiver inválido.

**Resultado:** [ ]

**Observações:**

---

## T12 — Rosto muito longe

**Objetivo:** validar UX do enquadramento.

**Passos:**

1. Inicie tentativa válida.
2. Fique distante da câmera.

**Esperado:**

- feedback para aproximar-se;
- captura não ocorre.

**Resultado:** [ ]

---

## T13 — Rosto muito próximo

**Passos:**

1. Inicie tentativa válida.
2. Aproxime demais o rosto.

**Esperado:**

- feedback para afastar-se;
- captura não ocorre.

**Resultado:** [ ]

---

## T14 — Olhos fechados

**Passos:**

1. Inicie tentativa válida.
2. Mantenha os olhos fechados durante a validação.

**Esperado:**

- feedback para manter olhos abertos;
- auto-captura não conclui enquanto a condição persistir.

**Resultado:** [ ]

---

## T15 — Sorriso detectado

**Passos:**

1. Inicie tentativa válida.
2. Faça um sorriso evidente.

**Esperado:**

- feedback solicitando expressão neutra;
- auto-captura não conclui enquanto o sorriso for detectado.

**Resultado:** [ ]

---

# 4. Testes de estado e segurança do fluxo

## T16 — Nenhuma nova captura sem novo RFID

**Objetivo:** validar o bug recentemente corrigido.

**Passos:**

1. Conclua um acesso autorizado ou negado.
2. Permaneça em frente à câmera.
3. Não passe nenhum novo cartão.

**Esperado:**

- overlay final aparece;
- webcam fecha;
- `tentativa_id` é encerrada;
- tela volta a "Aguardando novo cartão RFID";
- nenhuma nova captura facial ocorre.

**Resultado:** [ ]

---

## T17 — Tentativa expirada

**Objetivo:** validar TTL de tentativa.

**Passos:**

1. Passe um cartão elegível.
2. Não conclua a biometria.
3. Aguarde mais que `ACCESS_ATTEMPT_TIMEOUT_SECONDS`.
4. Tente concluir a biometria ou consulte o resultado.

**Esperado:**

- tentativa não pode mais liberar acesso;
- status final `EXPIRADO` ou recusa equivalente;
- comando para ESP32 é `negar`;
- servo não abre.

**Resultado:** [ ]

---

## T18 — Regra muda entre RFID e face

**Objetivo:** validar a revalidação final.

**Preparação:**

- cartão elegível inicialmente.

**Passos:**

1. Passe o cartão.
2. Antes da captura facial, altere uma condição, por exemplo:
   - desative o usuário; ou
   - desative o local; ou
   - remova a permissão.
3. Faça a biometria correta.

**Esperado:**

- mesmo com face compatível, acesso negado;
- backend revalida regras antes de finalizar;
- histórico registra a negação.

**Resultado:** [ ]

**Regra alterada:** ______

---

## T19 — Repetição da mesma tentativa

**Objetivo:** validar idempotência.

**Passos:**

1. Capture o `tentativa_id` de uma tentativa já concluída.
2. Tente chamar novamente `verificar-face` com o mesmo ID.

**Esperado:**

- não deve gerar uma segunda liberação;
- não deve duplicar histórico;
- resposta deve indicar tentativa já concluída/indisponível.

**Resultado:** [ ]

---

## T20 — Releitura muito rápida do mesmo cartão

**Objetivo:** verificar proteção contra duas tentativas simultâneas.

**Passos:**

1. Passe o mesmo cartão duas vezes rapidamente antes de finalizar a primeira biometria.

**Esperado:**

- no máximo uma tentativa válida permanece pendente;
- sistema não abre dois fluxos de câmera;
- não ocorre liberação duplicada.

**Resultado:** [ ]

---

# 5. Testes do frontend

## T21 — Login e Bearer Token

**Passos:**

1. Faça login.
2. Abra DevTools > Network.
3. Acesse uma tela protegida.

**Esperado:**

```http
Authorization: Bearer <JWT>
```

- nenhuma rota administrativa protegida deve funcionar sem token.

**Resultado:** [ ]

---

## T22 — Simulador RFID da tela Validar Acesso

**Objetivo:** testar sem hardware.

**Passos:**

1. Abra `/validar-acesso`.
2. Selecione usuário.
3. Selecione dispositivo.
4. Clique em **Simular cartão**.
5. Faça biometria.

**Esperado:**

- usa `POST /arduino/verificar-cartao`;
- recebe tentativa real;
- câmera abre;
- usa `POST /arduino/verificar-face`;
- histórico real é atualizado.

**Resultado:** [ ]

---

## T23 — Histórico atualiza após decisão

**Passos:**

1. Conclua uma tentativa.
2. Observe "Últimos Acessos".

**Esperado:**

- novo acesso aparece sem precisar recarregar manualmente a página;
- usuário, local, resultado e similaridade coerentes.

**Resultado:** [ ]

---

## T24 — Feedback de erro coerente

Repita pelo menos três recusas:

- [ ] fora do horário;
- [ ] sem permissão;
- [ ] face incompatível.

**Esperado:**

Cada caso deve mostrar mensagem correspondente ao motivo real. Evite mensagens genéricas como "erro" quando o backend já fornece o motivo.

**Resultado geral:** [ ]

---

# 6. Testes do hardware

## T25 — LED verde

**Esperado:** somente acesso autorizado acende/aciona padrão verde.

**Resultado:** [ ]

## T26 — LED vermelho

**Esperado:** recusas acionam padrão vermelho.

**Resultado:** [ ]

## T27 — Buzzer de sucesso

**Esperado:** padrão sonoro de sucesso somente em autorização.

**Resultado:** [ ]

## T28 — Buzzer de negação

**Esperado:** padrão sonoro de recusa em negação.

**Resultado:** [ ]

## T29 — Servo

**Esperado:**

- acesso autorizado -> abre;
- acesso negado -> não abre;
- após intervalo configurado -> retorna à posição fechada.

**Resultado:** [ ]

**Fonte utilizada para o servo:** ______

---

# 7. Tempo de resposta

## T30 — Medição RFID → decisão

Faça pelo menos 10 tentativas válidas e anote:

| Tentativa | Resultado | Similaridade | Tempo (ms) |
|---|---|---:|---:|
| 1 |  |  |  |
| 2 |  |  |  |
| 3 |  |  |  |
| 4 |  |  |  |
| 5 |  |  |  |
| 6 |  |  |  |
| 7 |  |  |  |
| 8 |  |  |  |
| 9 |  |  |  |
| 10 |  |  |  |

**Média:** ______ ms

**Mínimo:** ______ ms

**Máximo:** ______ ms

**Resultado:** [ ]

---

# 8. Testes de auditoria administrativa

## T31 — Criar usuário

**Esperado:** ação aparece em `audit_logs`.

**Resultado:** [ ]

## T32 — Alterar permissão

**Esperado:** alteração auditada com admin, recurso, IP e horário.

**Resultado:** [ ]

## T33 — Cadastrar/substituir biometria

**Esperado:** ação administrativa registrada.

**Resultado:** [ ]

---

# 9. Checklist de evidências para apresentação

Antes de encerrar a sessão, tente sair com pelo menos:

- [ ] vídeo de um acesso totalmente autorizado;
- [ ] vídeo de uma recusa por horário;
- [ ] vídeo de cartão A + rosto B;
- [ ] foto do conjunto ESP32 + RC522 + LEDs + buzzer + servo;
- [ ] screenshot do painel administrativo;
- [ ] screenshot da tela `/validar-acesso`;
- [ ] screenshot da similaridade;
- [ ] screenshot do `tempo_resposta_ms`;
- [ ] screenshot do histórico;
- [ ] screenshot dos logs de auditoria;
- [ ] screenshot do Swagger;
- [ ] screenshot de um `tentativa_acesso` no banco;
- [ ] screenshot de Local 1:N Dispositivos.

---

# 10. Resumo final da homologação

| Categoria | Passou | Falhou | Bloqueado |
|---|---:|---:|---:|
| Fluxo principal |  |  |  |
| Regras de acesso |  |  |  |
| Biometria 1:1 |  |  |  |
| Frontend / UX |  |  |  |
| Segurança de estado |  |  |  |
| Hardware |  |  |  |
| Tempo de resposta |  |  |  |
| Auditoria |  |  |  |

## Bugs encontrados

### BUG-01

**Teste relacionado:**  
**Comportamento observado:**  
**Comportamento esperado:**  
**Evidência:**  
**Prioridade:**  

---

## Aprovação da rodada

- [ ] Fluxo principal aprovado.
- [ ] Regras negativas aprovadas.
- [ ] Biometria 1:1 aprovada.
- [ ] Hardware aprovado.
- [ ] Histórico/auditoria aprovados.
- [ ] Evidências salvas.
- [ ] Bugs críticos corrigidos ou documentados.

**Data:** ____ / ____ / ______

**Participantes:** ________________________________________

**Versão / commit testado:** ______________________________
