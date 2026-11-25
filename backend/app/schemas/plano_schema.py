from typing import List, Optional, Union
from pydantic import BaseModel, Field


class PlanoVantagem(BaseModel):
    texto: str
    icone: str
    destaque: bool = False
    incluido: bool = True


class PlanoItem(BaseModel):
    id: str
    nome: str
    slug: str
    badge: Optional[str] = None
    preco_mensal: float
    preco_formatado: str
    periodo: str = "/mês"
    descricao: str
    dispositivos: Union[int, str]
    usuarios: Union[int, str]
    tipo_suporte: str
    destaque: bool = False
    decoy: bool = False
    email_contato: Optional[str] = None
    vantagens: List[PlanoVantagem] = Field(default_factory=list)


class CheckoutValidacaoRequest(BaseModel):
    plano_id: str
    nome_organizacao: str = Field(..., min_length=2, max_length=150)
    email_gestor: str = Field(..., min_length=5, max_length=150)
    documento: Optional[str] = None
    forma_pagamento: str = "cartao"
    valor_esperado: float


class CheckoutValidacaoResponse(BaseModel):
    sucesso: bool
    mensagem: str
    codigo_transacao: str
    plano_id: str
    plano_nome: str
    valor_cobrado: float
    valor_formatado: str
    data_autorizacao: str
