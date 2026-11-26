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
    return HTMLResponse(pagina_painel(papel, rows), headers={'Cache-Control':'no-store'})


HOSPEDAGEM_ROTULOS = {'gerenciada': 'Gerenciada', 'propria': 'Própria'}

# Página do painel por papel. Mesmos tokens e tema de dashboard.html (alinhados ao --ard-* do app).
PAGINA_PAINEL = """<!doctype html>
<html lang="pt-BR" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>__TITULO__ · ArdLock</title>
<link rel="icon" href="/favicon.ico">
<script>if (localStorage.getItem("theme") === "light") document.documentElement.dataset.theme = "light";</script>
<style>
:root{color-scheme:dark;--canvas:#0b1220;--surface:#111827;--surface-2:#172033;--ink:#f8fafc;--muted:#94a3b8;--line:rgb(148 163 184/18%);--line-strong:rgb(148 163 184/32%);--primary:#60a5fa;--on-primary:#0b1220;--warning:#fbbf24;--radius-sm:10px;--radius-md:14px}
:root[data-theme="light"]{color-scheme:light;--canvas:#f6f8fb;--surface:#fff;--surface-2:#f1f5f9;--ink:#172033;--muted:#5b6b82;--line:#e2e8f0;--line-strong:#cbd5e1;--primary:#2563eb;--on-primary:#fff;--warning:#b45309}
*{box-sizing:border-box}
body{margin:0;background:var(--canvas);color:var(--ink);font:15px/1.5 Roboto,"Helvetica Neue",Arial,"Liberation Sans",sans-serif}
a{color:var(--primary)}
:focus-visible{outline:3px solid var(--primary);outline-offset:2px}
.top{border-bottom:1px solid var(--line);background:var(--surface)}
.top-inner,main{width:min(1100px,100%);margin:0 auto;padding-inline:clamp(16px,3vw,32px)}
.top-inner{display:flex;align-items:center;gap:14px;min-height:64px}
.brand{display:inline-flex;align-items:center;gap:10px;font-size:1.1rem;font-weight:600}
.scope{padding-left:14px;border-left:1px solid var(--line-strong);color:var(--muted);font-size:.9rem}
.icon-btn{display:grid;place-items:center;width:40px;height:40px;margin-left:auto;border:0;border-radius:var(--radius-sm);background:none;color:var(--muted);cursor:pointer}
.icon-btn:hover{background:color-mix(in srgb,var(--ink) 8%,transparent);color:var(--ink)}
.icon-btn svg{width:20px;height:20px}
main{padding-top:32px;padding-bottom:64px}
h1{margin:0;font-size:clamp(1.55rem,2.4vw,2rem);font-weight:500;letter-spacing:-.02em}
.sub{margin:4px 0 24px;color:var(--muted)}
.panel{overflow:hidden;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface)}
table{width:100%;border-collapse:collapse}
th,td{padding:14px 20px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}
th{color:var(--muted);font-size:.8rem;font-weight:400}
tr:last-child td{border-bottom:0}
td strong{display:block;font-weight:500}
td small{color:var(--muted);font-size:.84rem}
.btn{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 16px;border-radius:var(--radius-sm);background:var(--primary);color:var(--on-primary);font-weight:500;text-decoration:none;white-space:nowrap}
.btn:hover{background:color-mix(in srgb,var(--primary) 86%,var(--ink))}
.badge{display:inline-flex;align-items:center;gap:6px;color:var(--warning);font-size:.9rem}
.badge::before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor}
.vazio{padding:28px 20px;color:var(--muted)}
@media (max-width:640px){
  .scope{display:none}
  thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
  table,tbody,tr,td{display:block}
  tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px;padding:16px;border-bottom:1px solid var(--line)}
  tr:last-child{border-bottom:0}
  td{padding:0;border:0}
  td[data-label]::before{content:attr(data-label);display:block;color:var(--muted);font-size:.78rem}
  td.lead,td.acao{grid-column:1/-1}
  td.lead::before{display:none}
  td.acao::before{display:none}
  .btn{width:100%;justify-content:center}
}
</style>
</head>
<body>
<header class="top"><div class="top-inner">
<span class="brand"><img src="/ard-lock-icon.svg" alt="" width="38" height="22">ArdLock</span>
<span class="scope">Plataforma, conta de __PAPEL__</span>
<button type="button" class="icon-btn" id="tema" aria-label="Alternar tema claro e escuro"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>
</div></header>
<main>
<h1>__TITULO__</h1>
<p class="sub">__SUBTITULO__</p>
<section class="panel" aria-labelledby="titulo-lista"><h2 id="titulo-lista" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">Operações</h2>
__CONTEUDO__
</section>
</main>
<script>
document.getElementById("tema").addEventListener("click", function () {
  var claro = document.documentElement.dataset.theme !== "light";
  document.documentElement.dataset.theme = claro ? "light" : "dark";
  localStorage.setItem("theme", claro ? "light" : "dark");
});
</script>
</body>
</html>"""


def pagina_painel(papel, rows):
    """Monta a página do painel com as linhas já consultadas (sem tocar no banco)."""
    def linha(row):
        cliente_id, nome, operacao, hospedagem, slug = row[:5]
        hospedagem_rotulo = HOSPEDAGEM_ROTULOS.get(hospedagem, str(hospedagem or '—'))
        acesso = ('<a class="btn" href="/login?instancia=ardlock-office">Acessar operação</a>' if slug == 'ardlock-office'
                  else '<span class="badge">Instalação pendente</span>')
        return ('<tr>'
                '<td class="lead"><strong>' + escape(str(nome or '—')) + '</strong><small>ID ' + escape(str(cliente_id or '—')) + '</small></td>'
                '<td data-label="Operação">' + escape(str(operacao or '—')) + '</td>'
                '<td data-label="Hospedagem">' + escape(hospedagem_rotulo) + '</td>'
                '<td class="acao" data-label="Acesso">' + acesso + '</td>'
                '</tr>')
    titulo = 'Clientes da plataforma' if papel=='root' else 'Minha operação'
    subtitulo = ('Clientes cadastrados e a situação de cada operação.' if papel=='root'
                 else 'Operações vinculadas à sua conta e como acessá-las.')
    if rows:
        conteudo = ('<table><thead><tr><th scope="col">Cliente</th><th scope="col">Operação</th><th scope="col">Hospedagem</th>'
                    '<th scope="col">Acesso</th></tr></thead><tbody>'
                    + ''.join(linha(row) for row in rows) + '</tbody></table>')
    else:
        conteudo = '<p class="vazio">Nenhuma operação vinculada a esta conta.</p>'
    return (PAGINA_PAINEL.replace('__TITULO__', escape(titulo)).replace('__SUBTITULO__', escape(subtitulo))
            .replace('__PAPEL__', escape(papel)).replace('__CONTEUDO__', conteudo))

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
