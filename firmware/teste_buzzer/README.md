# Teste de LEDs e buzzer

Sketch independente para ESP32. Usa LED verde no GPIO 4 e vermelho no GPIO 16,
como o firmware principal. Repete continuamente: verde e buzzer ligados por um
segundo; depois vermelho aceso e buzzer desligado por um segundo.
Não usa Wi-Fi, RFID ou servo e não exige `secrets.h`.

## Ligação para controle

O sketch usa GPIO 2 (D2 na placa), com `digitalWrite(HIGH/LOW)` para buzzer
ativo. Um buzzer passivo pode apenas clicar nesse teste; nao ha geracao de tons.

- Positivo do buzzer em J8; jumper do GPIO D2 até I8.
- Negativo do buzzer conectado ao GND.
- A fileira 8 não pode estar ligada também ao 3V3 ou a outro GPIO.

F8–J8 são interligados. B2 é apenas uma coordenada da protoboard, não significa
GPIO 2: use B2 como origem do jumper somente se ele realmente estiver conectado
ao pino D2 do ESP32. Desligue o USB antes de mudar os jumpers.

Antes de energizar uma ligação direta, confirme que o consumo do buzzer é
compatível com o GPIO. Essa informação ainda não foi fornecida; funcionar em
3 V não confirma essa compatibilidade. Se a ligação continuar no 3V3, o código
não poderá desligar o buzzer.

## Gravar

Na raiz deste checkout, execute:

```bash
bash firmware/teste_buzzer/update
```

Para outra porta:

```bash
PORT=/dev/ttyUSB1 bash firmware/teste_buzzer/update
```

A gravação substitui temporariamente o programa de acesso do ESP32. Para voltar:

```bash
bash firmware/blink/update
```

Feche o monitor serial com Ctrl+C antes de gravar novamente. Ctrl+C fecha o
monitor, mas o teste continua no ESP32; desconecte o USB para encerrar.
