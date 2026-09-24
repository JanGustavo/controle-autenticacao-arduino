# 🔐 Fluxo de validação facial

A biometria operacional é executada pelo backend em modo **1:1 estrito**.

## Entrada do Totem

Após o RFID gerar uma `tentativa_id`, o Totem envia a captura:

```http
POST /api/v1/arduino/verificar-face?tentativa_id=<UUID>
Authorization: Bearer <JWT_ADMIN>
Content-Type: multipart/form-data
```

O backend:

1. valida a tentativa PENDENTE;
2. extrai o embedding da captura;
3. busca somente o vetor do titular identificado pelo RFID;
4. realiza comparação 1:1;
5. revalida usuário, dispositivo, local, permissão, dia e horário;
6. grava a decisão e o histórico.

## Saída

```json
{
  "tentativa_id": "3b75c2c1-1e6d-4f52-9aa3-45f59ce77700",
  "usuario_id": 17,
  "nome": "Jan",
  "local_id": 1,
  "aprovado": true,
  "similaridade": 0.91,
  "comando": "liberar",
  "mensagem": "Acesso autorizado.",
  "tempo_resposta_ms": 1432
}
```

O Totem não informa `aprovado`. O ESP32 também não informa `aprovado`.
Ambos consomem a decisão calculada pelo backend.

O threshold operacional atual é **0.80**.
