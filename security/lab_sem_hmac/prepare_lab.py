"""Gera somente o schema e dados fictícios; nunca lê a configuração de produção."""
import os
import secrets
import shutil
from pathlib import Path

lab = Path(__file__).resolve().parent
repo = lab.parent.parent
init = lab / 'generated' / 'init'
init.mkdir(parents=True, exist_ok=True)
source = (repo / 'backend' / 'init.sql').read_text()
marker = '-- Administrador inicial para desenvolvimento:'
if source.count(marker) != 1:
    raise SystemExit('Schema mudou: revisar o separador antes de preparar o laboratório.')
# A seção anterior contém apenas DDL, sem cadastros/credenciais de exemplo.
schema = source.split(marker)[0]
if 'INSERT INTO' in schema.upper():
    raise SystemExit('Schema contém dados inesperados; revisão necessária.')
(init / '000_schema.sql').write_text(schema)
for migration in sorted((repo / 'backend' / 'migrations').glob('*.sql')):
    shutil.copy2(migration, init / migration.name)
shutil.copy2(lab / 'seed.sql', init / '999_lab_seed.sql')
env = lab / '.env.lab'
if not env.exists():
    fd = os.open(env, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w') as output:
        output.write(f'LAB_DB_PASSWORD={secrets.token_hex(24)}\n')
        output.write(f'LAB_JWT_SECRET={secrets.token_hex(32)}\n')
print('Schema e dados fictícios preparados; segredos exclusivos do laboratório gerados.')
