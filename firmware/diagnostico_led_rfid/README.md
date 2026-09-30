# Diagnóstico de bancada — LEDs + RC522 + Backend

Este sketch isola a primeira etapa de validação física do ArdLock.

Ele foi criado para testar **somente**:

- LED verde;
- LED vermelho;
- leitor RFID RC522;
- comunicação SPI;
- Wi-Fi;
- `GET /api/v1/health`;
- fluxo real `POST /api/v1/arduino/verificar-cartao`;
- polling de `GET /api/v1/arduino/resultado-acesso`.

**Servo e buzzer ficam desligados deste diagnóstico.**

Isso reduz as variáveis elétricas durante a primeira rodada de bancada.

## Pinagem usada

A pinagem abaixo é a mesma configurada atualmente em `firmware/blink/blink.ino`.

| Componente | Sinal | ESP32 |
|---|---|---:|
| LED verde | sinal | GPIO 4 |
| LED vermelho | sinal | GPIO 16 |
| RC522 | SCK | GPIO 33 |
| RC522 | MISO | GPIO 34 |
| RC522 | MOSI | GPIO 32 |
| RC522 | SS / SDA | GPIO 14 |
| RC522 | RST | GPIO 27 |
| RC522 | VCC | **3V3** |
| RC522 | GND | GND |

> O sketch consegue detectar conflito entre os pinos configurados e testar se o RC522 responde via SPI.  
> Ele **não consegue confirmar eletricamente sozinho** se um LED foi ligado invertido, se o resistor está correto ou se um jumper está no furo errado. Por isso o teste dos LEDs é visual.

## Preparação

Copie:

```bash
cp firmware/diagnostico_led_rfid/secrets.example.h \
   firmware/diagnostico_led_rfid/secrets.h
```

Edite:

```cpp
#define WIFI_SSID "..."
#define WIFI_PASSWORD "..."
#define API_URL "http://IP_DO_BACKEND:8001"
#define DEVICE_ID "ESP32-ENTRADA-01"
```

O `DEVICE_ID` precisa existir na tabela `dispositivo` e estar ligado ao local correto.

## O que deve aparecer no Serial Monitor

Use **115200 baud**.

Na inicialização:

```text
[OK] Mapa de pinos sem conflitos internos.
Testando LED VERDE
Testando LED VERMELHO
RC522 VersionReg: 0x..
[OK] RC522 respondeu via SPI.
[OK] IP: ...
Health HTTP: 200
[OK] Backend acessivel.
```

Se `VersionReg` retornar `0x00` ou `0xFF`, confira primeiro:

1. VCC do RC522 em 3V3;
2. GND comum;
3. SCK 33;
4. MISO 34;
5. MOSI 32;
6. SS/SDA 14;
7. RST 27.

## Teste A — LEDs sem backend

Ao ligar o ESP32:

1. LED verde deve piscar 3 vezes;
2. LED vermelho deve piscar 3 vezes.

Se o Serial disser que o teste ocorreu e o LED não acender, o problema é de bancada/polaridade/resistor/jumper, não da regra de acesso.

## Teste B — apenas leitura RFID

Aproxime um cartão.

Esperado:

```text
[RFID] UID lido: A1B2C3D4
```

Isso comprova que:

```text
RC522 -> SPI -> ESP32
```

está funcionando.

## Teste C — cartão recusado pelo backend

Use um cartão:

- não cadastrado; ou
- usuário inativo; ou
- fora da permissão; ou
- fora do horário.

Esperado:

- backend responde diferente de HTTP 200;
- LED vermelho pisca 3 vezes;
- câmera não deve iniciar para uma tentativa recusada.

## Teste D — RFID elegível + biometria

Use um cartão elegível.

Esperado:

1. backend cria `tentativa_id`;
2. LED verde dá um flash curto;
3. Totem recebe `RFID_APROVADO` e abre a câmera;
4. ESP32 faz polling de `resultado-acesso`;
5. enquanto a biometria não termina, aparece `[POLL] aguardando biometria...`;
6. se o backend retornar `liberar`, LED verde pisca 3 vezes;
7. se retornar `negar`, LED vermelho pisca 3 vezes.

Neste sketch **nenhum servo ou buzzer é acionado**.

## Limite do teste de pinos

O firmware verifica se dois componentes foram configurados por engano com o mesmo GPIO.

Isso valida a **configuração lógica**.

Para validar a montagem física ainda é necessário observar:

- LED correto acendendo;
- UID aparecendo no Serial;
- `VersionReg` do RC522 diferente de `0x00` e `0xFF`;
- resposta HTTP do backend.

## Buzzer — deixar para a segunda rodada

Não conecte o buzzer em 5 V apenas porque outro buzzer parecido funciona nessa tensão.

Primeiro identifique:

- modelo;
- se é ativo ou passivo;
- tensão nominal/faixa;
- corrente nominal;
- se é buzzer simples ou módulo com transistor.

Quando esses dados estiverem confirmados, o buzzer pode ser testado isoladamente antes de entrar no firmware principal.

## Servo — deixar fora desta bancada

O SG90 não participa deste sketch.

Quando ele for testado com fonte externa:

- alimentação do servo deve vir da fonte adequada;
- ESP32 e fonte externa precisam compartilhar GND;
- o sinal continua vindo do GPIO;
- não use uma fonte de notebook de 19/20 V diretamente no servo ou no ESP32.

A integração do servo só deve voltar depois que LEDs + RFID + backend estiverem estáveis.
