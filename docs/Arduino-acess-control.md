# Controle de Acesso com Reconhecimento Facial
### Levantamento de Requisitos

## Descrição Geral do Sistema

O projeto consiste em um sistema de controle de acesso que combina leitura de cartão RFID, reconhecimento facial processado localmente e um microcontrolador ESP32 responsável pela sinalização física (LED e buzzer) e pelo acionamento de um servo motor que simula a abertura de uma porta.

O fluxo de funcionamento é o seguinte: o usuário aproxima o cartão do leitor RFID; o ESP32 envia essa leitura ao servidor; o servidor confirma se o cartão existe e, em caso positivo, aciona a webcam para capturar o rosto do usuário; a imagem é convertida em um vetor numérico e comparada com o vetor previamente cadastrado para aquele cartão; o servidor então verifica o horário de acesso permitido e o status do cadastro, e envia a decisão final ao ESP32, que libera ou nega o acesso por meio do LED, do buzzer e do servo.

## Requisitos Funcionais

Funcionalidades que o sistema deve executar.

| ID | Nome do requisito | Descrição |
|----|---|---|
| RF01 | Leitura de cartão RFID | O sistema deverá identificar o usuário ao aproximar o cartão do leitor RFID. |
| RF02 | Captura de imagem facial | Após a leitura do cartão, o sistema deverá acionar a webcam e capturar uma foto do rosto do usuário. |
| RF03 | Geração do vetor facial | O sistema deverá converter a imagem facial capturada em um vetor numérico (embedding) por meio do módulo de reconhecimento facial. |
| RF04 | Comparação facial 1:1 | O sistema deverá comparar o vetor facial capturado apenas com o vetor cadastrado do dono do cartão lido. |
| RF05 | Validação de horário de acesso | O sistema deverá verificar se o horário da tentativa de acesso está dentro da janela permitida para o usuário. |
| RF06 | Validação de status do usuário | O sistema deverá verificar se o cadastro do usuário está ativo antes de liberar o acesso. |
| RF07 | Acionamento do atuador físico | O sistema deverá mover o servo motor, simulando a abertura da porta, quando o acesso for liberado. |
| RF08 | Sinalização do resultado | O sistema deverá acender o LED verde ou vermelho e emitir um padrão sonoro no buzzer conforme o resultado da verificação. |
| RF09 | Registro de histórico | O sistema deverá registrar toda tentativa de acesso, incluindo o motivo da recusa quando aplicável. |
| RF10 | Cadastro de usuários | O sistema deverá permitir o cadastro de usuários, associando cartão RFID e vetor facial. |

> **Observação:** a decisão de liberar ou negar o acesso é resultado direto da combinação dos requisitos RF04, RF05 e RF06 — cartão válido, rosto compatível, horário permitido e usuário ativo —, não constituindo uma funcionalidade separada.

## Requisitos Não Funcionais

Características, restrições e condições de funcionamento do sistema.

| ID | Nome do requisito | Descrição |
|----|---|---|
| RNF01 | Tempo de resposta | O tempo entre a leitura do cartão e a decisão final deverá ser, idealmente, inferior a 4 segundos. |
| RNF02 | Precisão do reconhecimento facial | A similaridade mínima entre os vetores faciais para considerar a mesma pessoa deverá ser de 85%, podendo ser ajustada. |
| RNF03 | Privacidade dos dados | O sistema não deverá armazenar a foto do rosto capturado, apenas o vetor numérico gerado a partir dela. |
| RNF04 | Processamento local | O reconhecimento facial deverá ser executado localmente, sem depender de serviços de nuvem pagos. |
| RNF05 | Rastreabilidade dos eventos | Toda tentativa de acesso deverá ficar registrada e disponível para consulta no histórico do sistema. |
| RNF06 | Custo do protótipo | Os componentes de hardware adicionais ao já disponível deverão custar entre R$ 60 e R$ 120. |

> **Observação:** a regra de que o ESP32 apenas executa comandos e não toma decisões é uma definição de arquitetura do projeto, e não um requisito não funcional testável — por isso não consta nesta lista.
