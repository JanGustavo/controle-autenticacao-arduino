"""Prepare an isolated customer deployment; never starts or alters a database."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets

ROOT = Path(__file__).resolve().parents[1]


def prepare(slug, name, kind, port, output):
    if not re.fullmatch(r'[a-z][a-z0-9-]{1,39}', slug):
        raise ValueError('Identificador: 2–40 caracteres, letras minúsculas, números e hífen.')
    if kind not in ('empresa', 'evento') or not 1024 <= port <= 65535:
        raise ValueError('Tipo ou porta inválidos.')
    if not name.strip():
        raise ValueError('Informe o nome do cliente.')
    target = Path(output).resolve() / slug
    target.mkdir(parents=True, exist_ok=False, mode=0o700)
    password, jwt = secrets.token_hex(32), secrets.token_hex(48)
    # The legacy initializer contains demo records. Keep only its DDL, fail closed
    # if the audited boundaries change instead of copying demo identities.
    source = (ROOT / 'backend/init.sql').read_text()
    start = '-- Administrador inicial para desenvolvimento:'
    end = '-- Acelera a consulta do histórico de um usuário específico'
    if source.count(start) != 1 or source.count(end) != 1:
        target.rmdir()
        raise ValueError('init.sql mudou: revise os limites do schema limpo.')
    schema = source.split(start)[0] + source[source.index(end):]
    if re.search(r'\bINSERT\s+INTO\b', schema, re.I):
        target.rmdir()
        raise ValueError('Schema novo não pode conter dados de demonstração.')
    (target / 'init.sql').write_text(schema)
    (target / 'instance.json').write_text(json.dumps({
        'id': slug, 'name': name.strip(), 'type': kind,
        'license_status': 'not_configured',
        'note': 'Metadados operacionais; não implementam cobrança ou expiração.'
    }, ensure_ascii=False, indent=2) + '\n')
    env = f'POSTGRES_PASSWORD={password}\nJWT_SECRET={jwt}\nFRONTEND_URL=http://localhost:{port}\n'
    (target / '.env').write_text(env)
    os.chmod(target / '.env', 0o600)
    db = {'image': 'postgres:16-alpine', 'restart': 'unless-stopped',
          'environment': {'POSTGRES_DB': 'guardwalk', 'POSTGRES_USER': 'guardwalk',
                          'POSTGRES_PASSWORD': '${POSTGRES_PASSWORD:?required}'},
          'volumes': ['pgdata:/var/lib/postgresql/data', './init.sql:/docker-entrypoint-initdb.d/init.sql:ro'],
          'healthcheck': {'test': ['CMD-SHELL', 'pg_isready -U guardwalk -d guardwalk'], 'interval': '5s', 'timeout': '5s', 'retries': 20}}
    backend = {'build': {'context': str(ROOT / 'backend'), 'dockerfile': 'dockerfile'},
               'restart': 'unless-stopped',
               'environment': {'DATABASE_URL': 'postgresql://guardwalk:${POSTGRES_PASSWORD:?required}@db:5432/guardwalk',
                               'JWT_SECRET': '${JWT_SECRET:?required}', 'JWT_EXPIRE_MINUTES': '60',
                               'FRONTEND_URL': '${FRONTEND_URL:?required}', 'MAIL_ENABLED': 'false',
                               'IA_SQLITE_PATH': '/app/data/ia.sqlite3', 'PYTHONPATH': '/app'},
               'volumes': ['ia_data:/app/data', f'{ROOT / "scripts/bootstrap_instance.py"}:/app/bootstrap_instance.py:ro'],
               'depends_on': {'db': {'condition': 'service_healthy'}}}
    frontend = {'build': {'context': str(ROOT / 'frontend'), 'dockerfile': 'Dockerfile'},
                'restart': 'unless-stopped', 'ports': [f'127.0.0.1:{port}:80'],
                'depends_on': ['backend']}
    # Compose project scoping isolates service DNS, networks and both volumes.
    compose = {'name': f'guardwalk-{slug}', 'services': {'db': db, 'backend': backend, 'frontend': frontend},
               'volumes': {'pgdata': {}, 'ia_data': {}}}
    (target / 'compose.json').write_text(json.dumps(compose, indent=2) + '\n')
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('slug')
    parser.add_argument('--name', required=True)
    parser.add_argument('--type', choices=['empresa', 'evento'], default='empresa')
    parser.add_argument('--port', type=int, required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'instances')
    args = parser.parse_args()
    try:
        path = prepare(args.slug, args.name, args.type, args.port, args.output)
    except (ValueError, FileExistsError) as exc:
        parser.error(str(exc))
    print(f'Configuração preparada em {path}. Nenhum serviço foi iniciado. Consulte docs/produto/INSTANCIAS.md.')


if __name__ == '__main__':
    main()
