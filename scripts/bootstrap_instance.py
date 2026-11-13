"""Run interactively inside the NEW instance backend after migrations."""
import getpass
import os

import bcrypt
import psycopg


def main():
    email = input('E-mail do responsável: ').strip()
    name = input('Nome do responsável: ').strip()
    password = getpass.getpass('Senha (12 ou mais caracteres; até 72 bytes): ')
    if '@' not in email or not name or len(password) < 12 or len(password.encode()) > 72:
        raise SystemExit('Dados inválidos. Nenhuma alteração realizada.')
    if password != getpass.getpass('Confirme a senha: '):
        raise SystemExit('Senhas diferentes. Nenhuma alteração realizada.')
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
    with psycopg.connect(os.environ['DATABASE_URL']) as connection:
        with connection.cursor() as cursor:
            cursor.execute('LOCK TABLE administrador IN EXCLUSIVE MODE')
            cursor.execute('SELECT count(*) FROM administrador')
            if cursor.fetchone()[0]:
                raise SystemExit('Instância já possui administradores. Bootstrap recusado.')
            cursor.execute('INSERT INTO administrador (nome, email, senha_hash, principal) VALUES (%s, %s, %s, TRUE)',
                           (name, email, hashed))
    print('Responsável criado. Cadastre locais e dispositivos pelo painel.')


if __name__ == '__main__':
    main()
