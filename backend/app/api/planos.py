import uuid
from datetime import datetime
from typing import List
from fastapi import APIRouter, HTTPException, status

from app.schemas.plano_schema import (
    CheckoutValidacaoRequest,
    CheckoutValidacaoResponse,
    PlanoItem,
    PlanoVantagem,
)

router = APIRouter(prefix="/planos", tags=["Planos e Checkout"])

PLANOS_CATALOGO: List[PlanoItem] = [
    PlanoItem(
        id="basico",
        nome="Básico",
        slug="basico",
        badge="Início Rápido",
        preco_mensal=149.00,
        preco_formatado="R$ 149",
        periodo="/mês",
        descricao="Ideal para pequenas salas, estoques ou controle de entrada única.",
        dispositivos=1,
        usuarios=50,
        tipo_suporte="Suporte e manutenção padrão (horário comercial)",
        destaque=False,
        decoy=False,
        vantagens=[
            PlanoVantagem(texto="1 dispositivo (controladora ESP32 / RFID)", icone="memory", incluido=True),
            PlanoVantagem(texto="Até 50 usuários cadastrados", icone="groups", incluido=True),
            PlanoVantagem(texto="Biometria facial 1:1 e cartão RFID", icone="face", incluido=True),
            PlanoVantagem(texto="Suporte médio por chamado e e-mail", icone="support_agent", incluido=True),
            PlanoVantagem(texto="Suporte de manutenção padrão", icone="build", incluido=True),
            PlanoVantagem(texto="Histórico de acessos dos últimos 30 dias", icone="history", incluido=True),
            PlanoVantagem(texto="Sem acesso prioritário ou visita presencial", icone="close", destaque=False, incluido=False),
        ],
    ),
    PlanoItem(
        id="intermediario",
        nome="Profissional",
        slug="profissional",
        badge="Intermediário",
        preco_mensal=329.00,
        preco_formatado="R$ 329",
        periodo="/mês",
        descricao="Para operações em crescimento que precisam de mais de um ponto de acesso.",
        dispositivos=4,
        usuarios=150,
        tipo_suporte="Suporte médio",
        destaque=False,
        decoy=True,
        vantagens=[
            PlanoVantagem(texto="Até 4 dispositivos integrados", icone="developer_board", incluido=True),
            PlanoVantagem(texto="Até 150 usuários cadastrados", icone="groups", incluido=True),
            PlanoVantagem(texto="Biometria facial e regras de horários", icone="verified_user", incluido=True),
            PlanoVantagem(texto="Suporte médio comercial", icone="support_agent", incluido=True),
            PlanoVantagem(texto="Manutenção remota sob agendamento", icone="build", incluido=True),
            PlanoVantagem(texto="Sem suporte presencial emergencial", icone="close", destaque=False, incluido=False),
        ],
    ),
    PlanoItem(
        id="premium",
        nome="Avançado Empresarial",
        slug="avancado-empresarial",
        badge="Mais Escolhido",
        preco_mensal=389.00,
        preco_formatado="R$ 389",
        periodo="/mês",
        descricao="Solução completa com infraestrutura garantida e deslocamento da equipe para conserto presencial.",
        dispositivos=7,
        usuarios=500,
        tipo_suporte="Suporte prioritário 24/7 com equipe on-site",
        destaque=True,
        decoy=False,
        vantagens=[
            PlanoVantagem(texto="Até 7 dispositivos (ESP32/Arduino) simultâneos", icone="router", destaque=True, incluido=True),
            PlanoVantagem(texto="Até 500 usuários ativos e visitantes", icone="badge", destaque=True, incluido=True),
            PlanoVantagem(
                texto="Suporte prioritário com equipe técnica presencial: substituição ou reparo no local caso quebre Arduino ou leitor",
                icone="engineering",
                destaque=True,
                incluido=True,
            ),
            PlanoVantagem(texto="Canal VIP de suporte 24/7 (WhatsApp e Telefone)", icone="headset_mic", destaque=True, incluido=True),
            PlanoVantagem(texto="Assistente iArdLock com Inteligência Artificial incluso", icone="psychology", destaque=True, incluido=True),
            PlanoVantagem(texto="Auditoria detalhada e histórico ilimitado em tempo real", icone="analytics", destaque=True, incluido=True),
            PlanoVantagem(texto="Painel de múltiplos gestores com permissões granulares", icone="admin_panel_settings", destaque=True, incluido=True),
        ],
    ),
    PlanoItem(
        id="personalizado",
        nome="Personalizado",
        slug="personalizado",
        badge="Sob Demanda",
        preco_mensal=0.00,
        preco_formatado="Sob Demanda",
        periodo="",
        descricao="Para indústrias, universidades ou condomínios que demandam projeto de infraestrutura sob medida.",
        dispositivos="Ilimitados / Projeto customizado",
        usuarios="Ilimitados",
        tipo_suporte="SLA sob medida e gerente de conta dedicado",
        destaque=False,
        decoy=False,
        email_contato="janderson.gustavo1@gmail.com",
        vantagens=[
            PlanoVantagem(texto="Quantidade ilimitada de dispositivos e catracas", icone="all_inclusive", incluido=True),
            PlanoVantagem(texto="Sem limite de usuários cadastrados", icone="groups_3", incluido=True),
            PlanoVantagem(texto="Desenvolvimento de integrações e firmwares dedicados", icone="code", incluido=True),
            PlanoVantagem(texto="SLA de resposta contratual e visitas periódicas", icone="verified", incluido=True),
            PlanoVantagem(texto="Gerente de conta exclusivo e canal direto", icone="contact_support", incluido=True),
            PlanoVantagem(texto="Contato direto: janderson.gustavo1@gmail.com", icone="email", destaque=True, incluido=True),
        ],
    ),
]


@router.get("", response_model=List[PlanoItem])
def listar_planos():
    """Retorna os planos de licenciamento disponíveis para checkout."""
    return PLANOS_CATALOGO


@router.post("/validar-transacao", response_model=CheckoutValidacaoResponse)
def validar_transacao(dados: CheckoutValidacaoRequest):
    """
    Revalida o plano selecionado pelo frontend na transação,
    conferindo regras de preço e emitindo código de autorização simulado.
    """
    plano = next((p for p in PLANOS_CATALOGO if p.id == dados.plano_id), None)
    if not plano:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plano com identificador '{dados.plano_id}' não encontrado no catálogo.",
        )

    if plano.id == "personalizado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O plano personalizado requer contato direto via janderson.gustavo1@gmail.com.",
        )

    # Revalida o preço se o valor esperado divergir
    if abs(dados.valor_esperado - plano.preco_mensal) > 0.01:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Inconsistência de valor no checkout: o plano {plano.nome} custa R$ {plano.preco_mensal:.2f}.",
        )

    codigo = f"ARD-{uuid.uuid4().hex[:8].upper()}"
    agora = datetime.now().strftime("%d/%m/%Y às %H:%M:%S")

    return CheckoutValidacaoResponse(
        sucesso=True,
        mensagem=f"Transação autorizada com sucesso para {dados.nome_organizacao}! A licença do plano {plano.nome} está ativa.",
        codigo_transacao=codigo,
        plano_id=plano.id,
        plano_nome=plano.nome,
        valor_cobrado=plano.preco_mensal,
        valor_formatado=plano.preco_formatado,
        data_autorizacao=agora,
    )
