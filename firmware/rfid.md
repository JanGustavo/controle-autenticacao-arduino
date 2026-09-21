# 📡 Endpoint de Verificação RFID

**URL:** `POST http://localhost:8001/api/v1/arduino/verificar-cartao`

**Content-Type:** `application/json`

## 📥 Payload de Envio (Request)

O ESP32 deve ler o cartão e enviar o UID em formato de texto hexadecimal.

O sistema aceita UIDs de **8, 14 ou 20 caracteres**, utilizando letras maiúsculas ou minúsculas.

```json
{
  "uid_card": "A1B2C3D4"
}
```

## 📤 Respostas Esperadas (Responses)

### 🟢 Cenário 1: Cartão válido e encontrado no banco

**HTTP 200**

**Ação do ESP32:** Liberar o fluxo para a próxima etapa e aguardar a validação facial do Totem.

```json
{
  "valido": true,
  "usuario_id": 17,
  "nome": "Jan",
  "mensagem": "Cartão reconhecido. Aguardando validação facial."
}
```

### 🟡 Cenário 2: Cartão lido corretamente, mas não cadastrado

**HTTP 200**

**Ação do ESP32:** Negar o acesso imediatamente, acionando o LED vermelho e o buzzer de erro.

```json
{
  "valido": false,
  "usuario_id": null,
  "nome": null,
  "mensagem": "Cartão não cadastrado no sistema."
}
```

### 🔴 Cenário 3: Erro de formato, UID vazio ou tamanho incorreto

**HTTP 422**

**Ação do ESP32:** Tratar como erro de leitura do sensor RFID.

```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": [
        "body",
        "uid_card"
      ],
      "msg": "Value error, Formato de UID inválido. Esperado uma string hexadecimal (0-9, A-F) com exatamente 8, 14 ou 20 caracteres.",
      "input": "123XZ"
    }
  ]
}
```
