# Teste no celular com dados fictícios

Use o mesmo Wi-Fi do servidor. O laboratório está na porta 8002, não 8001.
Os valores a seguir foram fornecidos pelo organizador para testar a autenticação
do dispositivo; este passo não demonstra sua descoberta por captura de tráfego.

```bash
export BASE='http://192.168.0.20:8002'
curl --connect-timeout 3 --max-time 10 -i "$BASE/api/v1/health"
```

Inicie uma tentativa sem JWT, HMAC ou equipamento físico:

```bash
curl --fail-with-body --connect-timeout 3 --max-time 10 -sS \
  -X POST "$BASE/api/v1/arduino/verificar-cartao" \
  -H 'Content-Type: application/json' \
  --data '{"identificador_dispositivo":"ESP32-DEMO-01","uid_card":"CAFE2026"}' \
  -o "$HOME/ardlock-lab-tentativa.json"
cat "$HOME/ardlock-lab-tentativa.json"
```

Se houver 409, aguarde um minuto e repita o POST. A mesma tentativa ainda está
pendente. Se vier `BIOMETRIA` com um UUID, consulte imediatamente:

```bash
export TENTATIVA=$(python -c 'import json; from pathlib import Path; x=json.loads((Path.home()/"ardlock-lab-tentativa.json").read_text()); t=x.get("tentativa_id"); assert t, "Sem tentativa valida: confira a resposta do POST"; print(t)')
curl --connect-timeout 3 --max-time 10 -i --get \
  "$BASE/api/v1/arduino/resultado-acesso" \
  --data-urlencode "tentativa_id=$TENTATIVA" \
  --data-urlencode 'identificador_dispositivo=ESP32-DEMO-01'
```

Esperado: `PENDENTE` e `aguardar`. Após o timeout, pode vir `EXPIRADO` e `negar`.
Conclusão: um cliente externo conseguiu declarar a identidade fictícia do
equipamento para iniciar e consultar a tentativa. A porta não foi liberada;
a etapa facial autenticada continua necessária.
