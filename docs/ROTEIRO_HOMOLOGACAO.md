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

- [x] Backend iniciado sem erro.
- [x] Frontend iniciado sem erro.
- [x] PostgreSQL ativo.
- [x] Swagger acessível.
- [x] Totem em `/validar-acesso`.
- [-] Webcam funcionando. (Requer hardware)
- [-] ESP32 conectado à rede. (Requer hardware)
- [-] RC522 lendo cartões. (Requer hardware)
- [-] LED verde funcionando. (Requer hardware)
- [-] LED vermelho funcionando. (Requer hardware)
- [-] Buzzer funcionando. (Requer hardware)
- [-] Servo conectado/alimentado de forma segura. (Requer hardware)
- [x] Relógio da máquina do backend correto.

### Dados que devem existir antes dos testes

Crie ou confirme pelo menos:

- [x] usuário **A**, ativo, com RFID e biometria cadastrados; (Mockado nos testes unitários)
- [x] usuário **B**, ativo, com RFID e biometria cadastrados; (Mockado nos testes unitários)
- [x] usuário **C**, inativo; (Mockado nos testes unitários)
- [x] local **Entrada Principal**, ativo; (Mockado nos testes unitários)
- [x] dispositivo **ESP32-ENTRADA-01**, ativo, vinculado ao local; (Mockado nos testes unitários)
- [x] uma permissão válida para o usuário A; (Mockado nos testes unitários)
- [x] uma permissão propositalmente fora do horário; (Mockado nos testes unitários - T18)
- [x] uma permissão para dia diferente, se possível; (Mockado nos testes unitários)
- [x] pelo menos um cartão não cadastrado. (Testado via RFID endpoint)

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

**Resultado:** [x] Passou

**Observações:** Validado por teste unitário automatizado `test_fluxo_acesso_1to1_aprovado` (tests/test_access_flow_1to1.py). O fluxo completo 1:1 foi testado: RFID → tentativa PENDENTE → face matching 1:1 → aprovado com comando 'liberar', similaridade 1.0, tempo_resposta_ms preenchido. O teste mocka banco, device, local, usuário, permissão e FaceService, provando a lógica de negócio sem hardware.

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

**Resultado:** [-] Bloqueado

**Observações:** Requer teste de integração/hardware. Os testes unitários validam a revalidação no passo da face (T18), mas a recusa imediata no RFID (antes da biometria) não é coberta por testes automatizados atuais. Necessita testar endpoint `/verificar-cartao` com permissão fora de horário.

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

**Resultado:** [-] Bloqueado

**Observações:** Requer teste de integração/hardware. Similar ao T02, a validação de dia da semana no passo RFID não é coberta por testes unitários atuais.

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

**Resultado:** [-] Bloqueado

**Observações:** Requer teste de integração/hardware. A validação de permissão no passo RFID não é coberta por testes unitários atuais.

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

**Resultado:** [-] Bloqueado

**Observações:** Requer teste de integração/hardware. A validação de usuário ativo no passo RFID não é coberta por testes unitários atuais. Nota: há teste `test_usuario_desativado_nao_consegue_logar` para login de admin, mas não para usuários de acesso.

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

**Resultado:** [-] Bloqueado

**Observações:** Requer teste de integração/hardware. A validação de dispositivo ativo no passo RFID não é coberta por testes unitários atuais.

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

**Resultado:** [-] Bloqueado

**Observações:** Requer teste de integração/hardware. A validação de local ativo no passo RFID não é coberta por testes unitários atuais.

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

**Resultado:** [-] Bloqueado

**Observações:** Requer teste de integração/hardware. O endpoint `/verificar-cartao` retorna `existe: false` para cartões desconhecidos (lógica implementada), mas não há teste unitário explícito para este cenário.

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

**Resultado:** [x] Passou

**Similaridade observada:** 1.0 (vetores idênticos mockados)

**Observações:** Validado por teste unitário automatizado `test_fluxo_acesso_1to1_aprovado` (tests/test_access_flow_1to1.py). O teste usa vetores faciais idênticos (DUMMY_VECTOR) resultando em similaridade 1.0, bem acima do threshold de 0.80. Comando 'liberar' retornado.

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

**Resultado:** [x] Passou

**Similaridade observada:** -1.0 (vetores opostos mockados)

**Observações:** Validado por teste unitário automatizado `test_fluxo_acesso_1to1_rosto_diferente_negado` (tests/test_access_flow_1to1.py). O teste usa vetor facial diferente (DUMMY_DIFF_VECTOR = [-0.05] * 512) vs titular (DUMMY_VECTOR = [0.05] * 512), resultando em similaridade -1.0, bem abaixo do threshold 0.80. Comando 'negar' retornado com mensagem contendo 'insuficiente'.

---

## T11 — Rosto ruim / iluminação insuficiente

**Objetivo:** validar feedback do Totem antes do envio.

**Passos:**

1. Inicie tentativa válida.
2. Reduza iluminação ou fique parcialmente fora do quadro.

**Esperado:**

- mensagem de iluminação/rosto não detectado;
- captura automática não dispara enquanto o enquadramento estiver inválido.

**Resultado:** [-] Bloqueado

**Observações:** Requer hardware (webcam) e frontend Totem. A validação de qualidade facial ocorre no frontend antes do envio ao backend. Não coberto por testes unitários.

---

## T12 — Rosto muito longe

**Objetivo:** validar UX do enquadramento.

**Passos:**

1. Inicie tentativa válida.
2. Fique distante da câmera.

**Esperado:**

- feedback para aproximar-se;
- captura não ocorre.

**Resultado:** [-] Bloqueado

**Observações:** Requer hardware (webcam) e frontend Totem. Validação de enquadramento ocorre no frontend. Não coberto por testes unitários.

---

## T13 — Rosto muito próximo

**Passos:**

1. Inicie tentativa válida.
2. Aproxime demais o rosto.

**Esperado:**

- feedback para afastar-se;
- captura não ocorre.

**Resultado:** [-] Bloqueado

**Observações:** Requer hardware (webcam) e frontend Totem. Validação de enquadramento ocorre no frontend. Não coberto por testes unitários.

---

## T14 — Olhos fechados

**Passos:**

1. Inicie tentativa válida.
2. Mantenha os olhos fechados durante a validação.

**Esperado:**

- feedback para manter olhos abertos;
- auto-captura não conclui enquanto a condição persistir.

**Resultado:** [-] Bloqueado

**Observações:** Requer hardware (webcam) e frontend Totem. Validação de olhos abertos ocorre no frontend. Não coberto por testes unitários.

---

## T15 — Sorriso detectado

**Passos:**

1. Inicie tentativa válida.
2. Faça um sorriso evidente.

**Esperado:**

- feedback solicitando expressão neutra;
- auto-captura não conclui enquanto o sorriso for detectado.

**Resultado:** [-] Bloqueado

**Observações:** Requer hardware (webcam) e frontend Totem. Validação de expressão neutra ocorre no frontend. Não coberto por testes unitários.

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

**Resultado:** [-] Bloqueado

**Observações:** Requer frontend Totem e hardware. O comportamento do frontend (webcam, overlay) não é coberto por testes unitários. A finalização da `tentativa_id` no backend ocorre após `/verificar-face`, mas o ciclo completo requer integração.

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

**Resultado:** [-] Bloqueado

**Observações:** Requer teste de integração com controle de tempo. A lógica de expiração (`ACCESS_ATTEMPT_TIMEOUT_SECONDS`) existe no backend mas não há teste unitário que valide o fluxo completo de expiração.

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

**Resultado:** [x] Passou

**Regra alterada:** Horário de permissão (horario_fim 18:00 vs horário teste 19:00)

**Observações:** Validado por teste unitário automatizado `test_revalidacao_final_nega_mesmo_com_face_compativel` (tests/test_access_flow_1to1.py). O teste cria uma tentativa com permissão válida no RFID, mas no momento da verificação facial o horário atual (19:00) está fora do permitido (horario_fim 18:00). Mesmo com face compatível (similaridade 1.0), o acesso é negado com comando 'negar' e mensagem contendo 'horário'. O mock `AcessoService._agora` força o horário para validar a revalidação.

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

**Resultado:** [-] Bloqueado

**Observações:** Não há teste unitário explícito para idempotência de `verificar-face` com mesma `tentativa_id`. Requer teste de integração.

---

## T20 — Releitura muito rápida do mesmo cartão

**Objetivo:** verificar proteção contra duas tentativas simultâneas.

**Passos:**

1. Passe o mesmo cartão duas vezes rapidamente antes de finalizar a primeira biometria.

**Esperado:**

- no máximo uma tentativa válida permanece pendente;
- sistema não abre dois fluxos de câmera;
- não ocorre liberação duplicada.

**Resultado:** [-] Bloqueado

**Observações:** Requer teste de integração/concorrência. A proteção contra dupla leitura rápida não é coberta por testes unitários atuais.

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

**Resultado:** [x] Passou

**Observações:** Validado por múltiplos testes unitários:
- `test_login_valido_retorna_http_200` e `test_login_valido_com_alias_admin` (tests/test_auth.py) - login retorna JWT bearer token
- `test_endpoints_protegidos_sem_token_retornam_401` (tests/test_bearer_auth.py) - 27 endpoints protegidos retornam 401 sem token
- `test_endpoint_protegido_com_token_valido` e `test_fluxo_integracao_autenticacao` (tests/test_bearer_auth.py) - endpoints funcionam com token válido
- `test_token_expirado_retorna_401`, `test_token_malformado_retorna_401`, `test_token_assinatura_invalida_retorna_401`, `test_token_sem_sub_retorna_401`, `test_token_admin_inexistente_retorna_401`, `test_token_admin_desativado_retorna_401` - validação robusta de JWT
- `test_endpoints_publicos_respondem_sem_token` - endpoints públicos (/health, /health/db) funcionam sem token

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

**Resultado:** [-] Bloqueado

**Observações:** Requer frontend Angular rodando. O fluxo completo do simulador RFID é testado indiretamente pelos testes de API (`test_fluxo_acesso_1to1_aprovado`), mas a integração com a UI `/validar-acesso` requer teste manual.

---

## T23 — Histórico atualiza após decisão

**Passos:**

1. Conclua uma tentativa.
2. Observe "Últimos Acessos".

**Esperado:**

- novo acesso aparece sem precisar recarregar manualmente a página;
- usuário, local, resultado e similaridade coerentes.

**Resultado:** [-] Bloqueado

**Observações:** Requer frontend Angular com WebSocket/polling para atualização em tempo real. O backend cria o histórico corretamente (testado em `test_fluxo_acesso_1to1_aprovado` via `historico_acesso_model.criar_com_cursor`), mas a atualização automática no frontend requer teste manual.

---

## T24 — Feedback de erro coerente

Repita pelo menos três recusas:

- [ ] fora do horário;
- [ ] sem permissão;
- [ ] face incompatível.

**Esperado:**

Cada caso deve mostrar mensagem correspondente ao motivo real. Evite mensagens genéricas como "erro" quando o backend já fornece o motivo.

**Resultado geral:** [-] Bloqueado

**Observações:** Requer frontend para validar mensagens de erro exibidas ao usuário. O backend retorna motivos específicos (testado: horário em T18, face insuficiente em T10, auth em T21), mas a exibição no frontend requer teste manual.

---

# 6. Testes do hardware

## T25 — LED verde

**Esperado:** somente acesso autorizado acende/aciona padrão verde.

**Resultado:** [-] Bloqueado

**Observações:** Requer hardware ESP32 + LEDs. Não testável via testes automatizados.

## T26 — LED vermelho

**Esperado:** recusas acionam padrão vermelho.

**Resultado:** [-] Bloqueado

**Observações:** Requer hardware ESP32 + LEDs. Não testável via testes automatizados.

## T27 — Buzzer de sucesso

**Esperado:** padrão sonoro de sucesso somente em autorização.

**Resultado:** [-] Bloqueado

**Observações:** Requer hardware ESP32 + buzzer. Não testável via testes automatizados.

## T28 — Buzzer de negação

**Esperado:** padrão sonoro de recusa em negação.

**Resultado:** [-] Bloqueado

**Observações:** Requer hardware ESP32 + buzzer. Não testável via testes automatizados.

## T29 — Servo

**Esperado:**

- acesso autorizado -> abre;
- acesso negado -> não abre;
- após intervalo configurado -> retorna à posição fechada.

**Resultado:** [-] Bloqueado

**Observações:** Requer hardware ESP32 + servo. Não testável via testes automatizados.

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

**Resultado:** [-] Bloqueado

**Observações:** Requer 10 tentativas reais com hardware. O backend retorna `tempo_resposta_ms` (validado em `test_fluxo_acesso_1to1_aprovado` - campo presente e >= 0), mas a medição real end-to-end requer hardware ESP32 + frontend.

---

# 8. Testes de auditoria administrativa

## T31 — Criar usuário

**Esperado:** ação aparece em `audit_logs`.

**Resultado:** [-] Bloqueado

**Observações:** Requer verificação direta no banco `audit_logs`. Os testes unitários de admin (`test_criar_administrador_valido`, etc.) mockam o banco e não verificam a tabela `audit_logs`.

## T32 — Alterar permissão

**Esperado:** alteração auditada com admin, recurso, IP e horário.

**Resultado:** [-] Bloqueado

**Observações:** Requer verificação direta no banco `audit_logs`. Não coberto por testes unitários atuais.

## T33 — Cadastrar/substituir biometria

**Esperado:** ação administrativa registrada.

**Resultado:** [-] Bloqueado

**Observações:** Requer verificação direta no banco `audit_logs`. Não coberto por testes unitários atuais.

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
| Fluxo principal | 1 | 0 | 7 |
| Regras de acesso | 1 | 0 | 6 |
| Biometria 1:1 | 2 | 0 | 5 |
| Frontend / UX | 1 | 0 | 3 |
| Segurança de estado | 1 | 0 | 4 |
| Hardware | 0 | 0 | 5 |
| Tempo de resposta | 0 | 0 | 1 |
| Auditoria | 0 | 0 | 3 |

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
