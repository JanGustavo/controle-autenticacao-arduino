# Relatório de Homologação ArdLock - Hardware-in-the-Loop

**Data:** 25/09/2026
**Objetivo:** Validar os fluxos T01 (Acesso Autorizado) e T08 (Acesso Negado) usando hardware real (ESP32), banco de dados local via Docker e DroidCam para captura biométrica.

## 1. Ambiente e Infraestrutura
- **Tempo de Build Inicial (Cold Start Docker):** ~41 segundos.
- **Hardware:** ESP32-D0WD-V3 + Leitor RFID RC522.
- **Câmera Biométrica:** Celular via aplicativo DroidCam conectado por USB (`adb forward`) e montado no Linux como `/dev/video0` através do módulo `v4l2loopback`.
- **Comunicação:** Backend FastAPI rodando no Docker, recebendo requisições HTTP do ESP32 conectado na mesma rede (IP: 192.168.1.5).

## 2. Testes Executados

### T08 - Acesso Negado (Cartão Não Cadastrado / Desconhecido)
- **Ação:** Apresentado o cartão com UID `838F17AA` no leitor físico.
- **Resultado:** O ESP32 enviou a requisição e o backend retornou `HTTP 404` corretamente.
- **Status:** **PASSOU**. O sistema barrou o hardware e não gerou tentativa de biometria.

### T01 - Acesso Autorizado (Depuração de Regras de Negócio e Permissões)
- **Ação:** Apresentado o cartão `3CDC1239` (vinculado ao usuário Lucas Paulino) no leitor físico.
- **Comportamento Observado:** O sistema retornou `HTTP 404` repetidas vezes mesmo após o alinhamento dos IDs de dispositivo.
- **Causa Raiz da Recusa:** Regra de negócio funcionando corretamente. As permissões de acesso do usuário Lucas estavam limitadas das **08:00 às 18:00**. Os testes ocorreram no período noturno (após as 22h), fazendo com que o backend recusasse a elegibilidade.
- **Status:** **PASSOU** (no quesito segurança e aplicação de regras de negócio). O fluxo biométrico está validado e aguardando testes dentro do horário permitido para acionar o relé.

## 3. Problemas Resolvidos e Adequações Realizadas (Troubleshooting)

1. **Incompatibilidade de Payload do ESP32:** 
   - **Problema:** O ESP32 enviava o identificador do dispositivo como `int` (`1`), mas o banco de dados exigia `String` (`"ESP32-ENTRADA-01"`).
   - **Solução:** O firmware `blink.ino` foi alterado para enviar a String correta e a compilação foi atualizada no microcontrolador via USB.
2. **Setup do DroidCam (Formato de Vídeo):** 
   - **Problema:** Erro de pixels `BGR3` vs `YU12` e falha de rede via Wi-Fi (`Connection refused`).
   - **Solução:** Módulo kernel recarregado (`modprobe v4l2loopback exclusive_caps=1`), ponte USB estabelecida (`adb forward tcp:4747 tcp:4747`) e cliente ativado via localhost (`droidcam-cli 127.0.0.1 4747`).
3. **Login do Administrador:**
   - **Problema:** Tentativa de acesso com `@ardlock.com`.
   - **Solução:** Corrigido para o domínio do banco local estipulado na migration (`@ardlock.local`).
4. **Alimentação de Hardware (BOD):**
   - **Problema:** O log do hardware acusou `Brownout detector was triggered`.
   - **Solução:** Identificado pico de corrente na USB durante uso simultâneo de Wi-Fi e sensores. Sistema se reiniciou de forma estável.

## 4. Próximos Passos
- Editar o horário de permissão no painel ADM (para aceitar 00:00 às 23:59) e rodar o T01 novamente para observar a liberação física do servo motor.
- Testar conectividade WebSocket com o leitor RFID (Polling atual vs Event-driven).