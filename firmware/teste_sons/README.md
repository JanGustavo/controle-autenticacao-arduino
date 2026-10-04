# Teste de padrões sonoros

Teste independente para buzzer ativo no GPIO 2, LED verde no GPIO 4 e vermelho
no GPIO 16. Repete dois bipes de aprovação, pausa de 2,5 segundos, três bipes de
recusa e pausa de quatro segundos. Aprovação: dois bipes de 500 ms, separados
por 250 ms, com LED verde aceso durante todo o padrão. Recusa no teste: três
bipes de 150 ms, separados por 150 ms.
As pausas são silenciosas. Não executa leitura RFID, chamadas à API ou servo.

Na aplicação principal, aprovação usa dois bipes e recusa usa três. Não detectar
um cartão não produz som; falha ou timeout de uma tentativa produz recusa.
O bip curto de inicialização permanece para indicar o teste do hardware.

O padrão distingue os resultados pela quantidade de bipes, não por volume ou
frequência. Não aumenta a tensão do GPIO. O buzzer foi inferido como ativo pelo
som com alimentação contínua; o modelo e o consumo ainda não foram confirmados.
A ligação direta depende de compatibilidade elétrica com o GPIO.

## Uso

Na raiz do projeto:

```bash
bash firmware/teste_sons/update
```

O script compila e grava o teste no lugar do programa principal. Para encerrar,
desconecte o USB. Ctrl+C fecha o monitor serial, mas não interrompe o teste no
ESP32. Para restaurar o fluxo normal, feche o monitor e execute:

```bash
bash firmware/blink/update
```

Conexão lógica: GPIO D2 até I8, positivo do buzzer em J8, negativo no GND.
B2 só pode ser usado como origem se estiver conectado ao GPIO D2. A fileira 8
não pode estar conectada simultaneamente ao 3V3 ou a outro GPIO.
