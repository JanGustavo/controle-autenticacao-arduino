# ⚙️ Configuração de Ambiente (`.env`)

O backend utiliza a variável de ambiente abaixo para definir o endereço base do ESP32 onde o comando HTTP `POST` será despachado:

```env
ESP32_URL_COMANDO=http://192.168.1.100/api/v1/arduino/liberar-acesso
```

> **Nota:** Certifique-se de que o IP configurado corresponde ao endereço IP atribuído ao ESP32 na rede local.

---

## 📥 Estrutura de Payload Enviada pelo Backend (POST)

Assim que a biometria facial é processada e associada ao respectivo `uid_card` do usuário, o backend atua como cliente HTTP e envia um JSON estruturado para o ESP32.

### 🟢 1. Cenário de Sucesso (Acesso Liberado)

Disparado quando a similaridade facial atinge ou ultrapassa o limiar configurado (**Threshold**) e o usuário é reconhecido com sucesso.

- **Método:** `POST`
- **Content-Type:** `application/json`

```json
{
  "comando": "liberar",
  "usuario": "Jan",
  "similaridade": 0.97
}
```

**Ação esperada no ESP32:**

- Acionar o microservo/relé da catraca;
- Piscar os LEDs verdes;
- Acionar o buzzer de sucesso;
- Aguardar o tempo de passagem;
- Retornar ao estado de repouso.

---

### 🔴 2. Cenário de Falha (Acesso Negado)

Disparado quando o rosto não é compatível com o cadastro ou a similaridade fica abaixo do esperado.

- **Método:** `POST`
- **Content-Type:** `application/json`

```json
{
  "comando": "negar",
  "motivo": "Rosto incompatível",
  "similaridade": 0.12
}
```

**Ação esperada no ESP32:**

- Manter a catraca trancada;
- Piscar os LEDs vermelhos;
- Emitir o alerta sonoro pelo buzzer de erro;
- Retornar ao estado de repouso.
```