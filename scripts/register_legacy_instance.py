#!/usr/bin/env python3
"""Vincule o banco operacional atual ao catálogo, preservando seus cadastros."""
from pathlib import Path
import json
import secrets
import subprocess

ROOT = Path(__file__).resolve().parents[1]
credentials = ROOT/'instances/acessos-plataforma.json'

def main():
    accounts = json.loads(credentials.read_text())
    if 'gestor.office' not in accounts:
        accounts['gestor.office'] = secrets.token_urlsafe(24)
        credentials.chmod(0o600)
        credentials.write_text(json.dumps(accounts, indent=2))
    password = accounts['gestor.office']
    script = """
import sys, bcrypt
from app.database.connection import get_connection
pw=sys.stdin.read()
hashed=bcrypt.hashpw(pw.encode(),bcrypt.gensalt()).decode()
with get_connection() as db, db.cursor() as cursor:
 cursor.execute("INSERT INTO administrador(nome,email,senha_hash,principal,ativo) VALUES (%s,%s,%s,FALSE,TRUE) ON CONFLICT (email) DO NOTHING", ('Gestor ArdLock Office','gestor.office@ardlock.local',hashed))
print(hashed)
"""
    hashed = subprocess.check_output(['docker','exec','-i','controle-acesso-backend','python','-c',script],
                                     input=password,text=True).strip()
    # bcrypt hashes contain only the bcrypt alphabet, never SQL quotes.
    if not hashed.startswith('$2') or "'" in hashed:
        raise ValueError('Hash inesperado')
    sql = f"""
BEGIN;
SELECT pg_advisory_xact_lock(739202);
INSERT INTO cliente(codigo,nome) VALUES ('ardlock-office','ArdLock Office') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO instancia(slug,cliente_id,operacao,tipo,hospedagem,dominio)
SELECT 'ardlock-office',id,'Controle de acesso Office','empresa','gerenciada','ardlock.jangustavo.me'
FROM cliente WHERE codigo='ardlock-office' ON CONFLICT(slug) DO NOTHING;
INSERT INTO licenca(instancia_slug,inicio)
SELECT 'ardlock-office',current_date WHERE NOT EXISTS
(SELECT 1 FROM licenca WHERE instancia_slug='ardlock-office');
INSERT INTO conta_plataforma(login,senha_hash,papel,cliente_id)
SELECT 'gestor.office','{hashed}','gestor',id FROM cliente WHERE codigo='ardlock-office'
ON CONFLICT(login) DO NOTHING;
COMMIT;
"""
    subprocess.run(['docker','compose','-f',str(ROOT/'platform/compose.yaml'),'exec','-T','db',
                    'psql','-X','-v','ON_ERROR_STOP=1','-U','plataforma','-d','plataforma'],
                   input=sql,text=True,check=True)
    print('Instalação Office vinculada. Credenciais no arquivo privado existente.')

if __name__ == '__main__':
    main()
