"""Inicialize as contas sem expor senhas nos argumentos de processos ou no terminal."""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess

ROOT = Path(__file__).resolve().parent

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--demo', action='store_true', help='Adicionar clientes de demonstração')
    args = parser.parse_args()
    path = ROOT.parent / 'instances/acessos-plataforma.json'
    accounts = json.loads(path.read_text()) if path.exists() else {}
    accounts.setdefault('root', secrets.token_urlsafe(24))
    if args.demo:
        subprocess.run(['docker','compose','exec','-T','db','psql','-X','-v',
                        'ON_ERROR_STOP=1','-U','plataforma','-d','plataforma'],
                       input=(ROOT/'demo.sql').read_text(),text=True,check=True,cwd=ROOT)
        for login in ['gestor.openhouse','gestor.horizonte']:
            accounts.setdefault(login, secrets.token_urlsafe(24))
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w') as output:
        os.fchmod(output.fileno(), 0o600)
        json.dump(accounts, output, indent=2)
    config = {
        'accounts': accounts,
        'db': (path.parent/'.platform-db-password').read_text().strip(),
        'portal': (path.parent/'.portal-password').read_text().strip(),
    }
    subprocess.run(['docker','compose','run','--rm','--no-deps','-T',
                    'portal','python','-c',(ROOT/'provision_portal.py').read_text()],
                   input=json.dumps(config),text=True,check=True,cwd=ROOT)
    print(f'Contas preparadas. Credenciais privadas em {path}')

if __name__ == '__main__':
    main()
