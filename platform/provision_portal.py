"""Execute no ambiente Python do backend, passando a configuração por stdin."""
import json, sys, bcrypt, psycopg
from psycopg import sql
cfg=json.load(sys.stdin)
with psycopg.connect(host='plataforma-db',dbname='plataforma',user='plataforma',password=cfg['db']) as db:
    if not db.execute("SELECT 1 FROM pg_roles WHERE rolname='portal_leitura'").fetchone():
        db.execute(sql.SQL('CREATE ROLE portal_leitura LOGIN PASSWORD {}').format(sql.Literal(cfg['portal'])))
    db.execute('GRANT SELECT ON cliente, instancia, conta_plataforma, licenca, contrato, fatura, verificacao_operacional TO portal_leitura')
    clients = {'gestor.openhouse': 'demo-open-house', 'gestor.horizonte': 'demo-horizonte'}
    for login, password in cfg['accounts'].items():
        if login != 'root' and login not in clients:
            continue
        codigo = clients.get(login)
        cliente = None
        if codigo:
            row = db.execute('SELECT id FROM cliente WHERE codigo=%s', (codigo,)).fetchone()
            if row is None:
                continue
            cliente = row[0]
        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        db.execute('INSERT INTO conta_plataforma VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING',
                   (login, hashed, 'gestor' if codigo else 'root', cliente))
