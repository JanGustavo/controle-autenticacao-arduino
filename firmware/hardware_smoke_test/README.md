# Smoke Test de bancada — RFID + LEDs

Este teste isola os componentes de menor consumo do ArdLock antes de introduzir buzzer e servo.

Arquivo:

```text
firmware/hardware_smoke_test/hardware_smoke_test.ino
```

## Escopo

Este sketch testa somente:

- LED verde;
- LED vermelho;
- barramento SPI;
- RC522;
- leitura real do UID de um cartão.

**Buzzer e servo não são inicializados nem energizados pelo sketch.**

Isso é intencional. O objetivo é descobrir primeiro se alimentação, pinos, SPI e leitura RFID estão estáveis.

## Mapa de pinos usado

O mapa foi copiado do firmware principal atual:

| Componente | Sinal | GPIO ESP32 |
|---|---|---:|
| LED verde | sinal | 4 |
| LED vermelho | sinal | 16 |
| RC522 | SS/SDA | 14 |
| RC522 | RST | 27 |
| RC522 | SCK | 33 |
| RC522 | MISO | 34 |
| RC522 | MOSI | 32 |

Observação: GPIO 34 no ESP32 é entrada, portanto é compatível com o papel de **MISO** neste mapeamento.

## Alimentação do RC522

Use o RC522 em **3,3 V**, não em 5 V.

Antes de ligar:

```text
ESP32 3V3 -> RC522 3.3V
ESP32 GND -> RC522 GND
GPIO 14   -> RC522 SDA/SS
GPIO 27   -> RC522 RST
GPIO 33   -> RC522 SCK
GPIO 34   -> RC522 MISO
GPIO 32   -> RC522 MOSI
```

## Como executar

Abra o sketch em:

```text
firmware/hardware_smoke_test/hardware_smoke_test.ino
```

Garanta que a biblioteca **MFRC522** esteja instalada.

Compile e grave no ESP32. Depois abra o Serial Monitor em:

```text
115200 baud
```

## O que deve acontecer no boot

1. LED verde pisca duas vezes.
2. LED vermelho pisca duas vezes.
3. O ESP32 inicializa SPI e RC522.
4. O Serial Monitor mostra `VersionReg`.
5. Se a comunicação estiver válida, aparece:

```text
[OK] RC522 respondeu no barramento SPI.
```

6. Ao aproximar um cartão:

```text
[OK] Cartao RFID lido.
UID: A1B2C3D4
Tamanho do UID: 4 bytes
```

O LED verde pisca uma vez apenas para indicar **leitura física bem-sucedida**. Isso não significa autorização de acesso.

## Diagnóstico do RC522

O sketch lê o registrador `VersionReg`.

Valores comuns:

```text
0x91 -> MFRC522 v1.0
0x92 -> MFRC522 v2.0
0x88 -> clone comum
```

Se retornar:

```text
0x00
ou
0xFF
```

o teste considera falha de comunicação. Verifique primeiro alimentação, GND e os cinco fios de SPI/RST.

## Comandos pelo Serial Monitor

Digite:

```text
g -> pisca LED verde
r -> pisca LED vermelho
l -> testa os dois LEDs
c -> testa o RC522 novamente
p -> mostra o mapa de pinos
s -> mostra o status
```

## Checklist

- [ ] ESP32 inicia sem reset/brownout.
- [ ] LED verde pisca corretamente.
- [ ] LED vermelho pisca corretamente.
- [ ] RC522 responde com VersionReg diferente de 0x00/0xFF.
- [ ] Cartão é detectado.
- [ ] UID aparece no Serial Monitor.
- [ ] UID permanece igual ao aproximar o mesmo cartão novamente.
- [ ] Nenhum reset ocorre durante a leitura.
- [ ] Buzzer permanece fora do teste.
- [ ] Servo permanece fora do teste.

## Depois que esse teste passar

Volte ao firmware principal:

```text
firmware/blink/blink.ino
```

A próxima rodada deve validar:

```text
RFID físico
  -> POST /api/v1/arduino/verificar-cartao
  -> tentativa_id
  -> Totem / webcam
  -> biometria 1:1
  -> GET /api/v1/arduino/resultado-acesso
  -> LED verde ou vermelho
```

Durante essa rodada, mantenha servo e buzzer desconectados caso ainda não exista alimentação adequada.

## Buzzer e servo

Não assuma que um buzzer nominal de 3 V pode ser alimentado continuamente em 5 V só porque ele emitiu som em um teste. Confirme o modelo/datasheet antes.

O servo deve usar alimentação externa adequada. Quando for integrado:

- não alimente o servo pelo pino 3V3 do ESP32;
- use fonte 5 V apropriada ao servo;
- mantenha **GND comum** entre a fonte do servo e o ESP32;
- só depois faça o teste de carga e observe resets/brownouts.

A etapa de buzzer/servo deve ser um teste separado deste smoke test.
