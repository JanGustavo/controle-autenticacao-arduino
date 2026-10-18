"""Verifica o laboratório da porta 8002, sem hardware e sem dados reais."""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

base = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8002').rstrip('/')
if urlparse(base).port != 8002 or urlparse(base).scheme != 'http':
    raise SystemExit('Este verificador exige o laboratório HTTP na porta 8002.')
evidence = []


def call(name, path, expected, body=None, method='GET'):
    data = json.dumps(body).encode() if body is not None else None
    req = Request(base + path, data=data, method=method,
                  headers={'Content-Type': 'application/json'} if data else {})
    try:
        response = urlopen(req, timeout=10)
    except HTTPError as exc:
        response = exc
    with response:
        status = response.code
        content = json.loads(response.read())
    evidence.append({'teste': name, 'status': status, 'resposta': content})
    assert status == expected, (name, status, content)
    print(f'{name}: HTTP {status}')
    return content


call('Saude', '/api/v1/health', 200)
unknown = call('Dispositivo desconhecido sem token', '/api/v1/arduino/verificar-cartao',
               200, {'identificador_dispositivo': 'ESP32-FICTICIO', 'uid_card': '00000000'}, 'POST')
assert unknown['proxima_etapa'] == 'NEGADO'
payload = {'identificador_dispositivo': 'ESP32-DEMO-01', 'uid_card': 'CAFE2026'}
created = call('Identidade ficticia cadastrada declarada sem token',
               '/api/v1/arduino/verificar-cartao', 200, payload, 'POST')
assert created['proxima_etapa'] == 'BIOMETRIA' and created['tentativa_id']
attempt = created['tentativa_id']
query = urlencode({'tentativa_id': attempt, 'identificador_dispositivo': 'ESP32-DEMO-01'})
pending = call('Consulta da tentativa ficticia sem token',
               '/api/v1/arduino/resultado-acesso?' + query, 200)
assert pending['comando'] == 'aguardar' and pending['status'] == 'PENDENTE'
call('Leitura duplicada', '/api/v1/arduino/verificar-cartao', 409, payload, 'POST')
wrong = urlencode({'tentativa_id': attempt, 'identificador_dispositivo': 'ESP32-OUTRO'})
call('Dispositivo divergente', '/api/v1/arduino/resultado-acesso?' + wrong, 404)
call('Face sem token', '/api/v1/arduino/verificar-face?tentativa_id=' + attempt,
     401, method='POST')
lab = Path(__file__).resolve().parent
output = lab / 'evidence'
output.mkdir(exist_ok=True)
(output / 'verification.json').write_text(json.dumps({
    'executado_em_utc': datetime.now(timezone.utc).isoformat(),
    'alvo': base, 'dados': 'exclusivamente ficticios', 'testes': evidence,
    'conclusao': 'Inicio e consulta de tentativa sem autenticacao de dispositivo; nenhuma liberacao.'
}, ensure_ascii=False, indent=2))
print('Nenhuma liberacao, foto, conta administrativa ou atuador envolvidos.')
