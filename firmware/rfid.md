# 📡 Contrato RFID do ESP32

## 1. Iniciar tentativa

**Endpoint**

```http
POST /api/v1/arduino/verificar-cartao
Content-Type: application/json
```

O ESP32 envia apenas evidência física e sua identidade lógica:

```json
{
  "uid_card": "A1B2C3D4",
  "identificador_dispositivo": "ESP32-ENTRADA-01"
}
```

Antes de iniciar a biometria, o backend valida:

1. dispositivo cadastrado e ativo;
2. local cadastrado e ativo;
3. cartão cadastrado;
4. usuário ativo;
5. permissão para o local;
6. dia da semana;
7. janela de horário.

Se alguma dessas regras falhar, a biometria não é executada.

Quando elegível, o backend retorna uma tentativa:

```json
{
  "existe": true,
  "tentativa_id": "3b75c2c1-1e6d-4f52-9aa3-45f59ce77700",
  "usuario_id": 17,
  "nome": "Jan",
  "mensagem": "Cartão reconhecido e dentro da permissão. Aguardando validação facial.",
  "proxima_etapa": "BIOMETRIA"
}
```

## 2. Consultar decisão

O ESP32 não envia um resultado biométrico. Ele consulta a decisão calculada
pelo backend:

```http
GET /api/v1/arduino/resultado-acesso?tentativa_id=<UUID>&identificador_dispositivo=ESP32-ENTRADA-01
```

Enquanto a face ainda não foi processada:

```json
{
  "status": "PENDENTE",
  "comando": "aguardar",
  "aprovado": null,
  "similaridade": 0.0,
  "mensagem": "Validação facial ainda em andamento.",
  "tempo_resposta_ms": null
}
```

Quando concluída:

```json
{
  "status": "AUTORIZADO",
  "comando": "liberar",
  "aprovado": true,
  "similaridade": 0.91,
  "mensagem": "Acesso autorizado.",
  "tempo_resposta_ms": 1432
}
```

O firmware executa apenas `aguardar`, `liberar` ou `negar`.
A decisão pertence ao backend.

> Segurança: autenticação HMAC por dispositivo será adicionada posteriormente
> às rotas físicas. O contrato já usa `identificador_dispositivo` para essa
> evolução sem alterar o payload de domínio.
