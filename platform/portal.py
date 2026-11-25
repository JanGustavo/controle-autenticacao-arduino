from html import escape
from pathlib import Path
import jwt
import time
from copy import deepcopy
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import Request
import bcrypt
import psycopg
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
basic = HTTPBasic(auto_error=False)

# Snapshot local dos planos que o root pode atribuir enquanto não há gateway.
# O formato já separa catálogo, limites e preço para permitir trocar a origem depois.
PLANOS_OPERACIONAIS = {
    'intermediario': {
        'schema_version': 1, 'id': 'intermediario', 'slug': 'profissional',
        'name': 'Profissional', 'badge': 'Intermediário',
        'description': 'Para operações em crescimento que precisam de mais de um ponto de acesso.',
        'pricing': {'amount': 329.00, 'currency': 'BRL', 'interval': 'month', 'provider': 'manual', 'provider_price_id': None},
        'limits': {'users': 150, 'devices': 4, 'managers': None},
        'features': ['Biometria facial e regras de horários', 'Suporte médio comercial', 'Manutenção remota sob agendamento'],
    },
    'premium': {
        'schema_version': 1, 'id': 'premium', 'slug': 'avancado-empresarial',
        'name': 'Avançado Empresarial', 'badge': 'Mais Escolhido',
        'description': 'Solução completa com infraestrutura garantida e atendimento presencial.',
        'pricing': {'amount': 389.00, 'currency': 'BRL', 'interval': 'month', 'provider': 'manual', 'provider_price_id': None},
        'limits': {'users': 500, 'devices': 7, 'managers': None},
        'features': ['Suporte prioritário 24/7 com equipe on-site', 'Assistente iArdLock com IA', 'Auditoria detalhada', 'Painel de múltiplos gestores'],
    },
}

def security(request: Request, credentials = Depends(basic)):
    token = request.cookies.get("ardlock_root")
    if token:
        try:
            return jwt.decode(token, Path("/run/secrets/portal_password").read_text().strip(), algorithms=["HS256"], options={"require":["exp","login"]})["login"]
        except jwt.InvalidTokenError:
            pass
    if credentials is None:
        raise HTTPException(401, headers={"WWW-Authenticate":"Basic realm=ArdLock"})
    return credentials
dummy = bcrypt.hashpw(b'invalid', bcrypt.gensalt())

def autenticar(papel, credentials):
    with psycopg.connect(host='plataforma-db', dbname='plataforma', user='portal_leitura',
                         password=Path('/run/secrets/portal_password').read_text().strip()) as db:
        conta = db.execute('SELECT senha_hash,papel,cliente_id FROM conta_plataforma WHERE login=%s',
                           (credentials if isinstance(credentials, str) else credentials.username,)).fetchone()
        senha = credentials.password.encode() if not isinstance(credentials, str) else b""
        if not conta or (not isinstance(credentials, str) and (len(senha)>72 or not bcrypt.checkpw(senha, conta[0].encode() if conta else dummy))):
            raise HTTPException(401, headers={'WWW-Authenticate':'Basic realm="ArdLock"'})
        if conta[1] != papel:
            raise HTTPException(403)
        return conta

def painel(papel, credentials):
    conta = autenticar(papel, credentials)
    with psycopg.connect(host='plataforma-db', dbname='plataforma', user='portal_leitura', password=Path('/run/secrets/portal_password').read_text().strip()) as db:
        sql = 'SELECT c.id,c.nome,i.operacao,i.hospedagem,i.slug FROM cliente c LEFT JOIN instancia i ON c.id=i.cliente_id'
        rows = db.execute(sql + (' ORDER BY c.id' if papel=='root' else ' WHERE c.id=%s'),
                          () if papel=='root' else (conta[2],)).fetchall()
    linhas = ''.join('<tr>'+''.join('<td>'+escape(str(v or '—'))+'</td>' for v in row[:4]) +
        ('<td><a href="/login?instancia=ardlock-office">Acessar operação</a></td>' if row[4] == 'ardlock-office' else '<td>Instalação pendente</td>') + '</tr>' for row in rows)
    titulo = 'Clientes da plataforma' if papel=='root' else 'Minha operação'
    return HTMLResponse(f"""<!doctype html><html lang="pt-BR"><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>{titulo} · ArdLock</title><style>body{{font:1rem system-ui;background:#101827;color:#eef4fa;margin:5vw}}table{{border-collapse:collapse;width:100%}}th,td{{text-align:left;padding:.8em;border-bottom:1px solid #475569}}</style><main><p>ArdLock · {papel}</p><h1>{titulo}</h1><table><tr><th>ID</th><th>Cliente</th><th>Operação</th><th>Hospedagem</th><th>Acesso</th></tr>{linhas}</table></main></html>""",headers={'Cache-Control':'no-store'})

@app.get('/plataforma/root')
def root(credentials: HTTPBasicCredentials = Depends(security)):
    autenticar('root', credentials)
    return HTMLResponse(Path('/portal/dashboard.html').read_text(), headers={'Cache-Control':'no-store'})

@app.post('/plataforma/logout')
def logout():
    response = RedirectResponse('/login', status_code=303, headers={'Cache-Control':'no-store'})
    response.delete_cookie('ardlock_root', path='/plataforma', secure=True, httponly=True, samesite='strict')
    return response

@app.get('/plataforma/gestor')
def gestor(credentials: HTTPBasicCredentials = Depends(security)):
    return painel('gestor', credentials)


def conexao():
    return psycopg.connect(host='plataforma-db', dbname='plataforma', user='portal_leitura',
                          password=Path('/run/secrets/portal_password').read_text().strip(),
                          row_factory=psycopg.rows.dict_row)

@app.get('/plataforma/api/dashboard')
def dashboard(dias: int = Query(30, ge=1, le=365), hospedagem: str = 'todas',
              credentials: HTTPBasicCredentials = Depends(security)):
    autenticar('root', credentials)
    if hospedagem not in ('todas','gerenciada','propria'):
        raise HTTPException(422, 'Hospedagem inválida')
    with conexao() as db:
        rows = db.execute('''
          SELECT c.id, c.nome, i.slug, i.operacao, i.hospedagem, i.dominio,
            coalesce(fin.mensal,0) AS mensal, fin.planos,
            coalesce(fat.faturado,0) AS faturado, coalesce(fat.recebido,0) AS recebido,
            coalesce(fat.pendente,0) AS pendente,
            coalesce(mon.amostras,0) AS amostras, coalesce(mon.sucessos,0) AS sucessos,
            ultimo.verificada_em, ultimo.disponivel,
            EXISTS(SELECT 1 FROM licenca l WHERE l.instancia_slug=i.slug
              AND l.inicio<=current_date AND (l.fim IS NULL OR l.fim>=current_date)
              AND l.revogada_em IS NULL) AS ativa
          FROM cliente c JOIN instancia i ON i.cliente_id=c.id
          LEFT JOIN LATERAL (
            SELECT sum(valor_mensal) mensal, string_agg(plano, ', ') planos FROM contrato
            WHERE instancia_slug=i.slug AND inicio<=current_date AND (fim IS NULL OR fim>=current_date)
          ) fin ON true
          LEFT JOIN LATERAL (
            SELECT sum(f.valor) faturado, sum(f.valor) FILTER(WHERE f.paga_em IS NOT NULL) recebido,
              sum(f.valor) FILTER(WHERE f.paga_em IS NULL) pendente
            FROM fatura f JOIN contrato ct ON ct.id=f.contrato_id
            WHERE ct.instancia_slug=i.slug AND f.cancelada_em IS NULL
              AND f.emitida_em>=current_date-(%s-1) AND f.emitida_em<=current_date
          ) fat ON true
          LEFT JOIN LATERAL (
            SELECT count(*) amostras, count(*) FILTER(WHERE disponivel) sucessos
            FROM verificacao_operacional WHERE instancia_slug=i.slug
              AND verificada_em>=now()-make_interval(days=>%s)
          ) mon ON true
          LEFT JOIN LATERAL (
            SELECT verificada_em,disponivel FROM verificacao_operacional WHERE instancia_slug=i.slug
            ORDER BY verificada_em DESC,id DESC LIMIT 1
          ) ultimo ON true
          WHERE (%s='todas' OR i.hospedagem=%s) ORDER BY c.nome,i.slug
        ''', (dias,dias,hospedagem,hospedagem)).fetchall()
        series = db.execute('''
          SELECT f.emitida_em AS dia, sum(f.valor) AS valor
          FROM fatura f JOIN contrato ct ON ct.id=f.contrato_id
          JOIN instancia i ON i.slug=ct.instancia_slug
          WHERE f.cancelada_em IS NULL AND f.emitida_em>=current_date-(%s-1)
            AND f.emitida_em<=current_date AND (%s='todas' OR i.hospedagem=%s)
          GROUP BY f.emitida_em ORDER BY f.emitida_em
        ''',(dias,hospedagem,hospedagem)).fetchall()
        agora=db.execute('SELECT now() AS atualizado_em').fetchone()['atualizado_em']
    return {'clientes':rows,'serie':series,'atualizado_em':agora,'dias':dias}

@app.get('/plataforma/api/clientes/{cliente_id}')
def detalhe(cliente_id: int, credentials: HTTPBasicCredentials = Depends(security)):
    autenticar('root', credentials)
    with conexao() as db:
        cliente=db.execute('SELECT id,nome,codigo FROM cliente WHERE id=%s',(cliente_id,)).fetchone()
        if not cliente:
            raise HTTPException(404)
        instancias=db.execute('SELECT * FROM instancia WHERE cliente_id=%s',(cliente_id,)).fetchall()
        for instancia in instancias:
            instancia['acesso_url'] = '/login?instancia=ardlock-office' if instancia['slug']=='ardlock-office' else None
        contratos=db.execute('SELECT ct.* FROM contrato ct JOIN instancia i ON i.slug=ct.instancia_slug WHERE i.cliente_id=%s ORDER BY ct.inicio DESC',(cliente_id,)).fetchall()
        faturas=db.execute('SELECT f.* FROM fatura f JOIN contrato ct ON ct.id=f.contrato_id JOIN instancia i ON i.slug=ct.instancia_slug WHERE i.cliente_id=%s ORDER BY f.emitida_em DESC,f.id DESC LIMIT 100',(cliente_id,)).fetchall()
        verificacoes=db.execute('SELECT v.* FROM verificacao_operacional v JOIN instancia i ON i.slug=v.instancia_slug WHERE i.cliente_id=%s ORDER BY v.verificada_em DESC,v.id DESC LIMIT 100',(cliente_id,)).fetchall()
        licencas=db.execute('SELECT l.* FROM licenca l JOIN instancia i ON i.slug=l.instancia_slug WHERE i.cliente_id=%s ORDER BY l.inicio DESC',(cliente_id,)).fetchall()
    return dict(cliente=cliente,instancias=instancias,contratos=contratos,faturas=faturas,verificacoes=verificacoes,licencas=licencas,
                catalogo_planos=list(PLANOS_OPERACIONAIS.values()))

class AtribuirPlano(BaseModel):
    plano_id: str

@app.put('/plataforma/api/licencas/{licenca_id}/plano')
def atribuir_plano(licenca_id: int, body: AtribuirPlano,
                   credentials: HTTPBasicCredentials = Depends(security)):
    autenticar('root', credentials)
    catalogo = PLANOS_OPERACIONAIS.get(body.plano_id)
    if not catalogo:
        raise HTTPException(422, 'Selecione um plano disponível.')
    plano = deepcopy(catalogo)
    plano['assignment'] = {'status': 'manual', 'assigned_at': datetime.now(timezone.utc).isoformat()}
    with conexao() as db:
        licenca = db.execute('SELECT id FROM licenca WHERE id=%s', (licenca_id,)).fetchone()
        if not licenca:
            raise HTTPException(404, 'Licença não encontrada.')
        result = db.execute('''
            UPDATE licenca SET plano_json=%s, limite_usuarios=%s, limite_dispositivos=%s,
              limite_gestores=%s WHERE id=%s RETURNING id
        ''', (psycopg.types.json.Jsonb(plano), plano['limits']['users'], plano['limits']['devices'],
              plano['limits']['managers'], licenca_id)).fetchone()
    return {'licenca_id': result['id'], 'plano': plano}

class LoginRoot(BaseModel):
    usuario: str
    senha: str

@app.post('/plataforma/api/login')
def login_root(body: LoginRoot):
    try:
        autenticar('root', HTTPBasicCredentials(username=body.usuario.strip(), password=body.senha))
    except HTTPException as error:
        raise HTTPException(error.status_code, 'Usuário ou senha incorretos.') from error
    token = jwt.encode({'login':body.usuario.strip(),'exp':int(time.time())+3600},
                       Path('/run/secrets/portal_password').read_text().strip(), algorithm='HS256')
    response = HTMLResponse('', headers={'Cache-Control':'no-store'})
    response.set_cookie('ardlock_root',token,max_age=3600,httponly=True,secure=True,samesite='strict',path='/plataforma')
    return response

@app.get('/plataforma/api/minha-licenca')
async def minha_licenca(request: Request):
    """The operational backend identity, never a browser-supplied tenant, selects the instance."""
    import os
    import httpx

    authorization = request.headers.get('authorization', '')
    if not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Sessão do gestor necessária.')
    backend = os.environ.get('OPERATIONAL_BACKEND_URL')
    slug = os.environ.get('OPERATIONAL_INSTANCE_SLUG')
    if not backend or not slug:
        raise HTTPException(503, 'Vínculo da instância não configurado.')
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            # Reuse the existing dependency that validates signature, expiry and active manager.
            result = await client.get(backend + '/api/v1/locais',
                                      headers={'Authorization': authorization})
        if result.status_code in (401, 403):
            raise HTTPException(result.status_code, 'Sessão do gestor inválida.')
        if result.status_code != 200:
            raise HTTPException(503, 'Não foi possível validar a sessão operacional.')
    except httpx.HTTPError as error:
        raise HTTPException(503, 'Serviço operacional indisponível.') from error

    with conexao() as db:
        instancia = db.execute(
            'SELECT i.*, c.nome AS cliente FROM instancia i JOIN cliente c ON c.id=i.cliente_id WHERE i.slug=%s',
            (slug,)).fetchone()
        if not instancia:
            raise HTTPException(404, 'Instância sem vínculo de licença.')
        licencas = db.execute("""
            SELECT *, CASE
              WHEN revogada_em IS NOT NULL THEN 'revogada'
              WHEN inicio>current_date THEN 'agendada'
              WHEN fim IS NOT NULL AND fim<current_date THEN 'expirada'
              ELSE 'vigente' END AS situacao,
              CASE WHEN fim IS NULL THEN NULL ELSE fim-current_date END AS dias_restantes
            FROM licenca WHERE instancia_slug=%s
            ORDER BY (revogada_em IS NULL AND inicio<=current_date AND (fim IS NULL OR fim>=current_date)) DESC,
                     inicio DESC,id DESC
        """, (slug,)).fetchall()
        contratos = db.execute("""
            SELECT * FROM contrato WHERE instancia_slug=%s AND inicio<=current_date
             AND (fim IS NULL OR fim>=current_date) ORDER BY inicio DESC,id DESC
        """,(slug,)).fetchall()
        proxima = db.execute("""
            SELECT f.*,ct.plano FROM fatura f JOIN contrato ct ON ct.id=f.contrato_id
            WHERE ct.instancia_slug=%s AND f.cancelada_em IS NULL AND f.paga_em IS NULL
            ORDER BY f.vencimento,f.id LIMIT 1
        """,(slug,)).fetchone()
        faturas = db.execute("""
            SELECT f.*,ct.plano FROM fatura f JOIN contrato ct ON ct.id=f.contrato_id
            WHERE ct.instancia_slug=%s ORDER BY f.emitida_em DESC,f.id DESC LIMIT 50
        """,(slug,)).fetchall()
        hoje = db.execute('SELECT current_date AS hoje').fetchone()['hoje']
    return dict(instancia=instancia,licenca=licencas[0] if licencas else None,
                contratos=contratos,proxima_fatura=proxima,faturas=faturas,data_referencia=hoje)
