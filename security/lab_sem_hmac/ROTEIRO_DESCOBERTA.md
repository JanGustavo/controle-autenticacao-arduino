# Roteiro: descoberta externa e autenticação do dispositivo

Este roteiro é para uma cópia do ArdLock em rede de laboratório, com banco
fictício. Não foi executado contra o sistema publicado. As respostas abaixo são
interpretações possíveis, não resultados de uma interceptação já realizada.
Não requer credenciais administrativas nem acesso ao código para as etapas de
descoberta. Requer autorização e o intervalo de endereços do laboratório.

## 1. Localizar o serviço

Na máquina participante (Pop!_OS ou Kali):

```bash
ip -br address
ip route
ip neigh
```

Revela endereço da própria máquina, rede/gateway e vizinhos já conhecidos.
Não revela URLs, cartões, tokens nem todos os dispositivos. Estar no mesmo
hotspot não garante comunicação entre clientes ou captura de seus pacotes.

Se Nmap estiver instalado, faça descoberta somente no intervalo reservado ao
laboratório. O intervalo a seguir é exemplo; substitua pelo intervalo real:

```bash
REDE_LAB='192.168.50.0/24'
nmap -sn "$REDE_LAB"
```

Isso procura hosts ativos; ausência de resposta não prova host desligado.
Para um IP encontrado e pertencente ao laboratório, procure serviços web:

```bash
IP_LAB='192.168.50.10'
nmap -sV -p 80,443,8001 "$IP_LAB"
BASE="http://$IP_LAB:8001"
```

Revela portas e possíveis serviços, não credenciais. Essa lista é uma busca
comum de portas web, não uma descoberta automática de todas as portas.
Se o laboratório só publicar porta 80, use essa porta no BASE. Para um serviço
público, é preciso antes descobrir o domínio por alguma informação pública;
estar fora da rede não permite deduzir arbitrariamente qual domínio é o ArdLock.

## 2. Observar respostas públicas

```bash
curl --connect-timeout 3 --max-time 10 -i "$BASE/"
curl --connect-timeout 3 --max-time 10 -i "$BASE/api/v1/health"
curl --connect-timeout 3 --max-time 10 -i "$BASE/docs"
curl --connect-timeout 3 --max-time 10 -D /tmp/ardlock-openapi.headers \
  -o /tmp/ardlock-openapi.json "$BASE/openapi.json"
cat /tmp/ardlock-openapi.headers
```

- HTML e cabeçalhos podem identificar a aplicação ou servidor.
- `health` com JSON `status: ok` identifica um serviço ativo, não acesso ao banco.
- Documentação acessível pode revelar contratos públicos da API.
- HTTP 200 sozinho não prova documentação disponível: o frontend Nginx atual
  pode devolver o HTML do Angular para `/docs` e `/openapi.json`. Ele encaminha
  `/api/` e `/ws/`, não esses dois caminhos. O backend direto os configura.
- Se for HTTPS, não use `curl -k`: falhas de certificado são evidências a registrar.

## 3. Ler contratos, se o OpenAPI realmente estiver disponível

```bash
python3 - <<'PY'
import json
from pathlib import Path
try:
    schema = json.loads(Path('/tmp/ardlock-openapi.json').read_text())
except (ValueError, OSError):
    raise SystemExit('Não foi obtido JSON OpenAPI; não continuar esta etapa.')
if 'openapi' not in schema or 'paths' not in schema:
    raise SystemExit('A resposta não é um contrato OpenAPI.')
for path, methods in schema['paths'].items():
    for method, operation in methods.items():
        if method not in {'get', 'post', 'put', 'patch', 'delete'}:
            continue
        security = operation.get('security', schema.get('security', []))
        print(method.upper(), path, 'segurança declarada:', security)
print('\nEsquemas de autenticação:')
print(json.dumps(schema.get('components', {}).get('securitySchemes', {}), indent=2))
print('\nContrato RFID:')
print(json.dumps(schema.get('components', {}).get('schemas', {}).get('VerificarCartaoRequest', {}), indent=2))
PY
```

Pode revelar uso de Bearer, campos obrigatórios e rotas do dispositivo.
Não revela a chave de assinatura JWT, a senha nem um token válido. Ausência de
segurança declarada é pista; a rota precisa ser testada para confirmar seu
comportamento, porque pode haver verificações não descritas no OpenAPI.

Se esse contrato não estiver público, registre a limitação. O participante pode
examinar os JavaScripts públicos da página pelo navegador, mas isso não garante
descoberta dos contratos exclusivos do firmware. Não entregar esses contratos
como se tivessem sido descobertos pela rede.

## 4. Testar se a rota exige identidade antes de processar dados

Somente na cópia com dados fictícios e sem atuador físico:

```bash
curl --max-time 10 -i -X POST \
  "$BASE/api/v1/arduino/verificar-cartao" \
  -H 'Content-Type: application/json' \
  --data '{}'
```

No código atual, espera-se 422 pelos campos ausentes. Isso mostra validação de
formato sem barreira inicial de autenticação; não prova cartão válido ou abertura.

Depois, use uma identidade explicitamente fictícia:

```bash
curl --max-time 10 -i -X POST \
  "$BASE/api/v1/arduino/verificar-cartao" \
  -H 'Content-Type: application/json' \
  --data '{"identificador_dispositivo":"ESP32-FICTICIO","uid_card":"00000000"}'
```

Registre status e conteúdo. O código atual pode responder 200 com NEGADO ao
aplicar regras de negócio. HTTP 200 não significa aprovação. Não invente um UID
válido como se tivesse sido descoberto; para reproduzir uma mensagem legítima,
é necessário demonstrar de onde veio (por exemplo, captura HTTP autorizada).

## 5. Comparar com uma operação protegida

Use uma tentativa inexistente e um arquivo fictício, sem rosto:

```bash
printf 'arquivo ficticio; nao contem imagem' > /tmp/ardlock-lab-upload.txt
curl --max-time 10 -i -X POST \
  "$BASE/api/v1/arduino/verificar-face?tentativa_id=00000000-0000-0000-0000-000000000000" \
  -F 'file=@/tmp/ardlock-lab-upload.txt'
```

No código atual, espera-se 401 sem token. Essa etapa deve mostrar uma barreira
funcionando. Não envia rosto real nem demonstra bypass da autenticação facial.

## 6. O que significa descobrir como o token funciona

Bearer significa apresentar uma credencial no cabeçalho Authorization. Saber
esse formato não fornece a credencial. Um JWT obtido legitimamente no laboratório
pode ter cabeçalho e claims decodificados para explicar `exp` e `sub`; decodificar
não verifica a assinatura nem permite produzir um token aceito. HTTPS impede que
uma captura passiva revele automaticamente tokens e JSON.

## 7. Interceptação é uma etapa separada

Wireshark pode observar tráfego visível à máquina. Não pressupor que esse tráfego
inclua o ESP32 só porque está na mesma rede. Para mostrar adulteração, o laboratório
precisa de uma posição no caminho da comunicação, explicitamente descrita, e de
um trecho que não esteja protegido por TLS corretamente validado. Curl gera
requisições próprias; não intercepta requisições de outras pessoas.

As provas existentes `demo_api.py` e `demo_firmware.py` usam mocks/stubs. Elas
demonstram comportamento de rotas e aceitação de um comando virtual, mas não
substituem evidência de interceptação ou liberação física real.

## Evidências para a apresentação

Para cada etapa registre comando, informação conhecida antes, informação nova,
status HTTP e efeito observado. Diferencie descoberta, consulta, início de
tentativa, autenticação facial e liberação. A conclusão deve corresponder ao
último efeito realmente comprovado.

Referências:
- [OWASP: REST e autorização por endpoint](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP: proteção TLS](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)
